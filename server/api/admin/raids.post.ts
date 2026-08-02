import { getSupabaseAdmin } from '../../utils/supabase'
import { validateRaidPayload } from '../../utils/raids'
import { requireAdmin } from '../../utils/auth'
import { publishRaidChange } from '../../utils/realtime'

/**
 * Jr master only: schedule a new boss raid.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const payload = validateRaidPayload(await readBody(event))

  const client = getSupabaseAdmin()
  const { data, error } = await client
    .from('boss_raids')
    .insert({ ...payload, created_by: admin.user?.id })
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return data
})
