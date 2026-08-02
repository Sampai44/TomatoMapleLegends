/**
 * Ported from `server/services/legends.ts` `syncGuildMembers` — the roster
 * upsert + snapshot archive logic. Kept identical so website and bot write
 * the same data.
 */
export async function syncGuildMembers(client, members) {
  const now = new Date().toISOString()

  const { data: existing, error: fetchError } = await client
    .from('guild_members')
    .select('char_name, level, fame, exp, guild_rank, job')

  if (fetchError) throw new Error(`failed to load existing roster: ${fetchError.message}`)

  const byName = new Map((existing ?? []).map((row) => [row.char_name, row]))
  const snapshots = []
  let unchanged = 0

  for (const m of members) {
    const prev = byName.get(m.charName)
    const changed =
      !prev ||
      prev.level !== m.level ||
      prev.fame !== m.fame ||
      prev.exp !== m.exp ||
      prev.guild_rank !== m.guildRank ||
      prev.job !== m.job

    if (changed) {
      snapshots.push({
        char_name: m.charName,
        level: m.level,
        fame: m.fame,
        exp: m.exp,
        guild_rank: m.guildRank,
        job: m.job
      })
    } else {
      unchanged++
    }
  }

  let archived = 0
  if (snapshots.length > 0) {
    const { error: snapError } = await client.from('member_snapshots').insert(snapshots)
    if (snapError) throw new Error(`failed to archive snapshots: ${snapError.message}`)
    archived = snapshots.length
  }

  const { error: upsertError } = await client.from('guild_members').upsert(
    members.map((m) => ({
      char_name: m.charName,
      guild_rank: m.guildRank,
      job: m.job,
      job_branch: m.jobBranch,
      level: m.level,
      exp: m.exp,
      fame: m.fame,
      ranking: m.ranking,
      is_donor: m.isDonor,
      avatar_url: m.avatarUrl,
      legends_url: m.legendsUrl,
      last_seen: now,
      updated_at: now
    })),
    { onConflict: 'char_name' }
  )
  if (upsertError) throw new Error(`failed to upsert roster: ${upsertError.message}`)

  return { scraped: members.length, upserted: members.length, archived, unchanged, syncedAt: now }
}