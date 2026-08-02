import { getSupabaseAdmin } from '../../../utils/supabase'

/**
 * Public: this IGN's own signups on a raid, including declined ones (so the
 * submitter sees the rejection reason). Others' signups are never exposed
 * here — the /api/raids list only shows approved names.
 */
export default defineEventHandler(async (event) => {
  const raidId = Number(getRouterParam(event, 'id'))
  const ign = String(getQuery(event).ign ?? '').trim()

  if (!raidId || !ign || ign.length > 20) {
    throw createError({ statusCode: 400, statusMessage: 'Provide ?ign=' })
  }

  const client = getSupabaseAdmin()
  const { data, error } = await client
    .from('raid_signups')
    .select('*')
    .eq('raid_id', raidId)
    .ilike('ign', ign)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { signups: data ?? [] }
})
