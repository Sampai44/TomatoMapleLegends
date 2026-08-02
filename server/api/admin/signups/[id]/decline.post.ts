import { getSupabaseAdmin } from '../../../../utils/supabase'
import { requireAdmin } from '../../../../utils/auth'
import { publishRaidChange } from '../../../../utils/realtime'

/**
 * Jr master only: decline a signup. A reason comment is required so the
 * submitter knows what to fix.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const signupId = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ reason?: string }>(event)
  const reason = body.reason?.trim()

  if (!reason || reason.length < 2 || reason.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'A rejection reason (2-500 chars) is required' })
  }

  const client = getSupabaseAdmin()
  const { data: signup, error: loadError } = await client
    .from('raid_signups')
    .select('*')
    .eq('id', signupId)
    .maybeSingle()

  if (loadError) throw createError({ statusCode: 500, statusMessage: loadError.message })
  if (!signup || signup.status !== 'pending') {
    throw createError({ statusCode: 404, statusMessage: 'Pending signup not found' })
  }

  const { error } = await client
    .from('raid_signups')
    .update({ status: 'declined', reason, decided_by: (event.context.auth?.uid as string) ?? null, decided_at: new Date().toISOString() })
    .eq('id', signupId)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return { ok: true }
})
