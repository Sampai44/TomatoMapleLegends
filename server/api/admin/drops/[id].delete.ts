import { getSupabaseAdmin } from '../../../utils/supabase'
import { requireAdmin } from '../../../utils/auth'
import { loadRaid, assertExpeditionLeader } from '../../../utils/raids'
import { publishRaidChange } from '../../../utils/realtime'

/**
 * Expedition leader only: remove a logged drop.
 */
export default defineEventHandler(async (event) => {
  const ctx = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  const client = getSupabaseAdmin()
  const { data: existing } = await client.from('raid_drops').select('*').eq('id', id).maybeSingle()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Drop not found' })

  const raid = await loadRaid(client, existing.raid_id)
  if (!raid) throw createError({ statusCode: 404, statusMessage: 'Raid not found' })
  assertExpeditionLeader(ctx, raid)

  const { error } = await client.from('raid_drops').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return { ok: true }
})