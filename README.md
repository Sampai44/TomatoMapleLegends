# Tomato — MapleLegends Guild Website

A guild website for the MapleLegends guild **Tomato**, built with **Nuxt 4**,
**Supabase** and deployed on **Vercel**. The roster is scraped automatically
from the [legends.ml guild member rankings](https://legends.ml/ranking/guildmembers?search=Tomato).

## What's inside

| Path | Purpose |
| --- | --- |
| `server/services/legends.ts` | The scraper: fetches ranking pages, parses the HTML table (rank, name, job, fame, level, exp, guild rank, donor flag, avatar), pages through until the full roster is collected |
| `scripts/sync.ts` | Standalone sync runner — `npm run scrape` (push to Supabase) or `npm run scrape:dry` (print only) |
| `server/api/sync.post.ts` | Protected endpoint that runs the same sync — called by the Vercel cron |
| `server/api/members.get.ts` | Public API: roster with search / branch / sort filters |
| `server/api/members.stats.get.ts` | Public API: guild stats (count, avg/max level, donors, job distribution) |
| `server/api/members/[name].get.ts` | Public API: single member + level history snapshots |
| `supabase/schema.sql` | Database schema (roster + append-only snapshots, RLS) |
| `app/` | Tomato-themed UI: home, roster, member detail pages |

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.

3. Copy `.env.example` to `.env` and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

   - `SUPABASE_URL` — project URL (Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (keep secret!)
   - `SYNC_SECRET` — a random string that protects `/api/sync`

4. Run locally:

   ```bash
   npm run dev
   ```

5. Seed the database with the current roster:

   ```bash
   npm run scrape
   ```

## Keeping the roster fresh

- **Vercel cron** (recommended): `vercel.json` schedules `GET /api/sync` every 6
  hours. Vercel adds the `Authorization: Bearer <CRON_SECRET>` header — set a
  `CRON_SECRET` env var in Vercel matching your `SYNC_SECRET`.
- **Manual**: `npm run scrape` from your machine, or hit `/api/sync` with
  `x-sync-secret: <SYNC_SECRET>`.

Each sync archives any level/fame/guild-rank changes into `member_snapshots`,
which powers the level-history chart on each member's page.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import it in Vercel — the Nuxt preset is detected automatically.
3. Add the env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`, `CRON_SECRET`) in Project Settings → Environment Variables.
4. Deploy. The cron in `vercel.json` starts firing on the default production
   branch automatically (note: crons require a Hobby or Pro plan).

## Scraper notes

- The ranking table is server-rendered HTML, so no headless browser is needed —
  just `fetch` + Cheerio.
- `legends.ml` caps `max` at **100 rows/page** even if you request more; the
  scraper pages until a page comes back short.
- Characters that leave the guild are kept in the table with a stale
  `last_seen` rather than deleted (handy for alts / rejoin tracking).
- Be nice to the source: one sync every 6 hours is plenty.
