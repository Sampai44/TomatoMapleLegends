import { getSupabaseAdmin } from '../../utils/supabase'
import { requireAdmin } from '../../utils/auth'
import { loadRaid, validateDropPayload } from '../../utils/raids'
import { publishRaidChange } from '../../utils/realtime'

/**
 * Jr master only: log a dropped item for a raid and set its disposition.
 * Kept items default to the raid's leader.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody(event).catch(() => ({}))) ?? {}
  const raidId = Number(body.raidId)

  const client = getSupabaseAdmin()
  const raid = await loadRaid(client, raidId)
  if (!raid) throw createError({ statusCode: 404, statusMessage: 'Raid not found' })

  const drop = validateDropPayload(body)
  if (drop.disposition === 'kept' && !drop.kept_by) drop.kept_by = raid.leader

  const { error } = await client
    .from('raid_drops')
    .insert({ ...drop, raid_id: raidId, noted_by: admin.user?.id })
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return { ok: true }
})