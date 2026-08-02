import { getSupabaseAdmin } from '../../../utils/supabase'
import { publishRaidChange } from '../../../utils/realtime'

/**
 * Public withdraw: cancel one's own pending/approved signup by IGN.
 */
export default defineEventHandler(async (event) => {
  const raidId = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ ign?: string }>(event)
  const ign = body.ign?.trim()

  if (!ign || ign.length < 2 || ign.length > 20) {
    throw createError({ statusCode: 400, statusMessage: 'Provide your IGN' })
  }

  const client = getSupabaseAdmin()
  const { data: signups, error } = await client
    .from('raid_signups')
    .select('*')
    .eq('raid_id', raidId)
    .ilike('ign', ign)
    .in('status', ['pending', 'approved'])
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  if (!signups?.length) {
    throw createError({ statusCode: 404, statusMessage: `No active signup found for ${ign}` })
  }

  const { error: delError } = await client
    .from('raid_signups')
    .delete()
    .eq('raid_id', raidId)
    .ilike('ign', ign)
    .in('status', ['pending', 'approved'])
  if (delError) throw createError({ statusCode: 500, statusMessage: delError.message })

  await publishRaidChange()
  return { ok: true }
})
