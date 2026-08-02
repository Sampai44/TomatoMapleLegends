import { getSupabaseAdmin } from '../../../utils/supabase'
import { publishRaidChange } from '../../../utils/realtime'
import {
  loadRaid,
  totalParticipantSeats,
  takenOf,
  openSlotsFor,
  blockedSlotsSummary
} from '../../../utils/raids'
import { jobQualifies } from '#shared/jobs'

const IGN_RE = /^[A-Za-z0-9 ]{2,20}$/

/**
 * Public signup for a raid. Anyone states their IGN; the server auto-checks
 * level and job against the party template (roster lookup), then the signup
 * sits as pending until a jr master approves and allocates, or rejects.
 */
export default defineEventHandler(async (event) => {
  const raidId = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ ign?: string; kind?: string }>(event)
  const ign = body.ign?.trim()
  const kind = body.kind === 'buyer' ? 'buyer' : 'participant'

  if (!ign || !IGN_RE.test(ign)) {
    throw createError({ statusCode: 400, statusMessage: 'IGN must be 2-20 letters/digits/spaces' })
  }

  const client = getSupabaseAdmin()
  const raid = await loadRaid(client, raidId)
  if (!raid) throw createError({ statusCode: 404, statusMessage: 'Raid not found' })
  if (raid.status !== 'scheduled') throw createError({ statusCode: 400, statusMessage: 'This raid is closed' })
  if (new Date(raid.scheduled_at).getTime() + raid.duration_minutes * 60000 < Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'This raid has already happened' })
  }

  const { data: allSignups, error: loadError } = await client
    .from('raid_signups')
    .select('*')
    .eq('raid_id', raidId)
    .in('status', ['pending', 'approved'])
  if (loadError) throw createError({ statusCode: 500, statusMessage: loadError.message })
  const signups = allSignups ?? []

  // Roster lookup for level/job auto-checks (non-members may still sign up —
  // their job/level are unknown and a jr master verifies in-game).
  const { data: roster } = await client
    .from('guild_members')
    .select('job, level')
    .ilike('char_name', ign)
    .maybeSingle()
  const charJob = roster?.job ?? ''
  const charLevel = roster?.level ?? 0

  if (kind === 'buyer') {
    if (!raid.buyers_enabled) {
      throw createError({ statusCode: 400, statusMessage: 'This raid is not accepting buyers' })
    }
    if (raid.buyer_limit > 0 && takenOf(signups, 'buyer') >= raid.buyer_limit) {
      throw createError({ statusCode: 409, statusMessage: `Buyer list is full (${raid.buyer_limit} max)` })
    }
  } else {
    if (charLevel > 0 && charLevel < raid.min_level) {
      throw createError({
        statusCode: 403,
        statusMessage: `${ign} is Lv ${charLevel} — this raid needs Lv ${raid.min_level}+`
      })
    }

    const seats = totalParticipantSeats(raid)
    if (takenOf(signups, 'participant') >= seats) {
      throw createError({ statusCode: 409, statusMessage: 'The expedition is full' })
    }

    if (charJob && openSlotsFor(raid, signups, charJob).length === 0) {
      const summary = blockedSlotsSummary(raid, signups, charJob)
      throw createError({
        statusCode: 403,
        statusMessage: summary
          ? `${ign} (${charJob}) can't take any open slot — still needed: ${summary}`
          : `${ign} (${charJob}) doesn't fit any open slot`
      })
    }
  }

  const { error } = await client.from('raid_signups').insert({
    raid_id: raidId,
    ign,
    kind,
    job: charJob,
    level: charLevel,
    status: 'pending'
  })

  if (error) {
    if (error.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: `${ign} is already signed up for this raid` })
    }
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await publishRaidChange()

  return {
    ok: true,
    status: 'pending',
    job: charJob,
    level: charLevel,
    inRoster: Boolean(roster)
  }
})
