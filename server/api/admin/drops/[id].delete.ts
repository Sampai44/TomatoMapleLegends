import { getSupabaseAdmin } from '../../../utils/supabase'
import { requireAdmin } from '../../../utils/auth'
import { publishRaidChange } from '../../../utils/realtime'

/**
 * Jr master only: remove a logged drop.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  const client = getSupabaseAdmin()
  const { error } = await client.from('raid_drops').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return { ok: true }
})