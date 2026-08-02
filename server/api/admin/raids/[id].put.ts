import { getSupabaseAdmin } from '../../../utils/supabase'
import { validateRaidPayload } from '../../../utils/raids'
import { requireAdmin } from '../../../utils/auth'
import { publishRaidChange } from '../../../utils/realtime'

/**
 * Jr master only: edit a raid (or cancel it via status='cancelled').
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const payload = validateRaidPayload(await readBody(event))

  const client = getSupabaseAdmin()
  const { data, error } = await client
    .from('boss_raids')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Raid not found' })

  await publishRaidChange()
  return data
})
