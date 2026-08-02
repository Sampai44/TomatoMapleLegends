import { getSupabaseAdmin } from '../../../../utils/supabase'
import { requireAdmin } from '../../../../utils/auth'
import { loadRaid, assertExpeditionLeader } from '../../../../utils/raids'
import { publishRaidChange } from '../../../../utils/realtime'

/**
 * Expedition leader only: mark an approved participant attacker as paid or
 * unpaid ({ paid: boolean }). Only kind=participant, status=approved.
 */
export default defineEventHandler(async (event) => {
  const ctx = await requireAdmin(event)
  const signupId = Number(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch(() => ({}))) ?? {}
  const paid = body.paid === true

  const client = getSupabaseAdmin()
  const { data: signup } = await client.from('raid_signups').select('*').eq('id', signupId).maybeSingle()
  if (!signup) throw createError({ statusCode: 404, statusMessage: 'Signup not found' })
  if (signup.kind !== 'participant' || signup.status !== 'approved') {
    throw createError({ statusCode: 400, statusMessage: 'Only approved participants can be marked paid' })
  }

  const raid = await loadRaid(client, signup.raid_id)
  if (!raid) throw createError({ statusCode: 404, statusMessage: 'Raid not found' })
  assertExpeditionLeader(ctx, raid)

  const { error } = await client
    .from('raid_signups')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('id', signupId)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return { ok: true }
})