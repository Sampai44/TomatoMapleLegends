import { getSupabaseAdmin } from '../../../../utils/supabase'
import { requireAdmin } from '../../../../utils/auth'
import { loadRaid, spareAnySeats } from '../../../../utils/raids'
import { publishRaidChange } from '../../../../utils/realtime'
import { jobQualifies } from '#shared/jobs'

/**
 * Jr master only: approve a signup and allocate it to a party (and slot job).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const signupId = Number(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch(() => ({}))) ?? {}
  const party = String(body.party ?? '').trim()
  const slotJob = String(body.slotJob ?? '').trim()

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

  if (signup.kind === 'buyer') {
    const raid = await loadRaid(client, signup.raid_id)
    if (!raid || !raid.buyers_enabled) throw createError({ statusCode: 400, statusMessage: 'Buyers not enabled for this raid' })

    const { data: approved } = await client
      .from('raid_signups')
      .select('id')
      .eq('raid_id', signup.raid_id)
      .eq('kind', 'buyer')
      .eq('status', 'approved')
    const buyers = approved?.length ?? 0
    if (raid.buyer_limit > 0 && buyers >= raid.buyer_limit) {
      throw createError({ statusCode: 409, statusMessage: `Buyer list is full (${raid.buyer_limit} max)` })
    }

    const { error } = await client
      .from('raid_signups')
      .update({ status: 'approved', party: 'Buyers', slot_job: 'Buyer', decided_by: (event.context.auth?.uid as string) ?? null, decided_at: new Date().toISOString() })
      .eq('id', signupId)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    await publishRaidChange()
    return { ok: true }
  }

  if (!party) throw createError({ statusCode: 400, statusMessage: 'Allocate to a party first' })

  const raid = await loadRaid(client, signup.raid_id)
  if (!raid || raid.status !== 'scheduled') throw createError({ statusCode: 400, statusMessage: 'Raid is closed' })

  const def = raid.slots.find((p) => p.party === party)
  if (!def) throw createError({ statusCode: 400, statusMessage: `No party named "${party}"` })

  const { data: allApproved } = await client
    .from('raid_signups')
    .select('*')
    .eq('raid_id', signup.raid_id)
    .eq('kind', 'participant')
    .eq('status', 'approved')

  const approvedList = allApproved ?? []
  const inParty = approvedList.filter((s) => s.party === party)
  if (inParty.length >= def.size) {
    throw createError({ statusCode: 409, statusMessage: `${party} is already full (${def.size})` })
  }

  const validSlots = def.jobs.filter((j) => j.job === 'Any' || jobQualifies(signup.job || '', j.job))
  const spare = spareAnySeats(def, approvedList, party)
  if (spare > 0 && !validSlots.some((j) => j.job === 'Any')) validSlots.push({ job: 'Any', count: spare })
  const slotJobFinal = slotJob && validSlots.some((j) => j.job === slotJob) ? slotJob : 'Any'
  if (slotJob && slotJob !== slotJobFinal) {
    throw createError({ statusCode: 400, statusMessage: `${signup.job || 'Unknown job'} can't fill the "${slotJob}" slot` })
  }
  if (!validSlots.some((j) => j.job === slotJobFinal)) {
    throw createError({ statusCode: 400, statusMessage: `${signup.job || 'Unknown job'} can't fill any open slot in ${party}` })
  }

  const slotTaken = approvedList.filter((s) => s.party === party && s.slot_job === slotJobFinal).length
  const slotTotal = def.jobs.find((j) => j.job === slotJobFinal)?.count ?? 0
  if (slotJobFinal !== 'Any' && slotTaken >= slotTotal) {
    throw createError({ statusCode: 409, statusMessage: `No ${slotJobFinal} slots left in ${party}` })
  }

  const { error } = await client
    .from('raid_signups')
    .update({ status: 'approved', party, slot_job: slotJobFinal, decided_by: (event.context.auth?.uid as string) ?? null, decided_at: new Date().toISOString() })
    .eq('id', signupId)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return { ok: true }
})
