// Creates (or updates) Supabase auth accounts for the guild Master and all
// Jr. Masters. Username = in-game name, shared password. Run:
//
//   node scripts/create-jr-accounts.mjs <shared-password>
//
// Uses the live roster from the database — anyone currently holding the rank
// gets an account; accounts for people who no longer hold it are left alone
// (delete them manually via the Supabase dashboard).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const password = process.argv[2]
if (!password || password.length < 8) {
  console.error('Usage: node scripts/create-jr-accounts.mjs <shared-password (min 8 chars)>')
  process.exit(1)
}

const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
const get = (key) => envFile.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim() ?? ''

const url = get('SUPABASE_URL') || process.env.SUPABASE_URL
const serviceRole = get('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRole) {
  console.error('.env is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const client = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: roster, error } = await client
  .from('guild_members')
  .select('char_name, guild_rank')
  .in('guild_rank', ['Master', 'Jr. Master'])
if (error) throw error

console.log(`Found ${roster.length} master/jr masters in the roster`)

const { data: existingPage } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 })
const existing = existingPage?.users ?? []
const byEmail = new Map(existing.map((u) => [u.email?.toLowerCase(), u]))

let created = 0
let updated = 0
for (const member of roster) {
  const email = `${member.char_name}@tomato.guild`
  const match = byEmail.get(email.toLowerCase()) ?? existing.find((u) => u.user_metadata?.char_name === member.char_name)

  if (match) {
    const { error: upd } = await client.auth.admin.updateUserById(match.id, {
      password,
      email_confirm: true,
      user_metadata: { char_name: member.char_name, guild_rank: member.guild_rank }
    })
    if (upd) {
      console.error(`  ! update failed for ${member.char_name}: ${upd.message}`)
      continue
    }
    updated++
    console.log(`  ~ ${email} — password reset`)
  } else {
    const { data: user, error: ins } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { char_name: member.char_name, guild_rank: member.guild_rank }
    })
    if (ins) {
      console.error(`  ! create failed for ${member.char_name}: ${ins.message}`)
      continue
    }
    created++
    console.log(`  + ${email} — account created`)
  }
}

console.log(`\nDone: ${created} created, ${updated} updated. Shared password set on all ${roster.length} accounts.`)
