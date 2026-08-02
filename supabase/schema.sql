-- Tomato guild website schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- Current roster snapshot. One row per character in the guild.
create table if not exists public.guild_members (
  id bigint generated always as identity primary key,
  char_name text not null unique,
  guild_rank text not null default 'Member',
  job text not null,
  job_branch text not null default '',
  level int not null default 1,
  exp numeric not null default 0,
  fame int not null default 0,
  ranking int not null default 0,
  is_donor boolean not null default false,
  avatar_url text,
  legends_url text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_members_level on public.guild_members (level desc);
create index if not exists idx_members_fame on public.guild_members (fame desc);

-- Append-only history of level/fame/guild-rank changes, written on every sync.
create table if not exists public.member_snapshots (
  id bigint generated always as identity primary key,
  char_name text not null,
  level int not null,
  fame int not null,
  exp numeric not null default 0,
  guild_rank text not null default 'Member',
  job text,
  snapshot_at timestamptz not null default now()
);

create index if not exists idx_snapshots_char on public.member_snapshots (char_name, snapshot_at);

-- RLS: anyone can read the public roster; writes happen through the
-- server-side service-role client (bypasses RLS).
alter table public.guild_members enable row level security;
alter table public.member_snapshots enable row level security;

drop policy if exists "roster is publicly readable" on public.guild_members;
create policy "roster is publicly readable"
  on public.guild_members for select
  using (true);

drop policy if exists "history is publicly readable" on public.member_snapshots;
create policy "history is publicly readable"
  on public.member_snapshots for select
  using (true);

-- ============ Jr master accounts & boss raids ============

-- Accounts exist ONLY for guild Master / Jr. Masters, pre-created by
-- scripts/create-jr-accounts.mjs. username = in-game name, shared password.
-- Members never log in — they sign up for raids with their IGN.
drop table if exists public.raid_signups;
drop table if exists public.boss_raids;
drop table if exists public.profiles;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  char_name text not null,
  email text not null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_char_lower on public.profiles (lower(char_name));

-- A scheduled boss raid.
-- `slots` is the party template, e.g.
--   [{"party":"Party 1","size":6,"jobs":[{"job":"Bishop","count":1}]},
--    {"party":"Party 2","size":6,"jobs":[{"job":"Bishop","count":1}]}]
-- Job counts may add up to less than the party size — spare seats are open to
-- anyone ("Any"). `cap mode` is expressed as a single party ("Expedition").
create table if not exists public.boss_raids (
  id bigint generated always as identity primary key,
  boss text not null default 'Horntail',
  scheduled_at timestamptz not null,          -- server time (UTC)
  duration_minutes int not null default 120,
  min_level int not null default 1,
  leader text not null default '',
  notes text not null default '',
  guide_url text not null default '',
  slots jsonb not null default '[]'::jsonb,
  buyers_enabled boolean not null default false,
  buyer_price bigint not null default 0,      -- mesos charged per buyer
  buyer_limit int not null default 0,         -- 0 = unlimited buyers
  status text not null default 'scheduled',   -- scheduled | cancelled
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_raids_scheduled on public.boss_raids (scheduled_at desc);

-- Signups are public submissions: anyone states their IGN, the server checks
-- roster job/level, then a jr master approves (and allocates to a party) or
-- declines with a reason comment.
create table if not exists public.raid_signups (
  id bigint generated always as identity primary key,
  raid_id bigint not null references public.boss_raids(id) on delete cascade,
  ign text not null,
  kind text not null default 'participant',   -- participant | buyer
  job text not null default '',               -- snapshot from roster ('' = not found)
  level int not null default 0,
  party text not null default '',             -- allocated by jr master on approval
  slot_job text not null default '',          -- allocated job slot ('Buyer' for buyers)
  status text not null default 'pending',     -- pending | approved | declined
  reason text not null default '',            -- jr master's rejection comment
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_signups_raid on public.raid_signups (raid_id);
-- One active signup per IGN per raid (declined ones don't count).
create unique index if not exists idx_signups_raid_ign
  on public.raid_signups (raid_id, lower(ign))
  where status <> 'declined';

-- RLS: the server (service role) does all writes. Public reads only for raids
-- and approved signups; users can read their own profile.
alter table public.profiles enable row level security;
alter table public.boss_raids enable row level security;
alter table public.raid_signups enable row level security;

drop policy if exists "raids are publicly readable" on public.boss_raids;
create policy "raids are publicly readable"
  on public.boss_raids for select
  using (true);

drop policy if exists "approved signups are publicly readable" on public.raid_signups;
create policy "approved signups are publicly readable"
  on public.raid_signups for select
  using (status = 'approved');

drop policy if exists "own profile is readable" on public.profiles;
create policy "own profile is readable"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Live updates: the site subscribes to these tables so rosters and raids
-- refresh in real time when the cron syncs or jr masters act.
do $$ begin
  alter publication supabase_realtime add table public.guild_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.boss_raids;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.raid_signups;
exception when duplicate_object then null; end $$;
