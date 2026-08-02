import type { H3Event } from 'h3'
import { getAuthContext, type AuthContext } from './auth'
import { getSupabaseAdmin } from './supabase'
import { jobQualifies, SLOT_JOB_SET } from '#shared/jobs'

export interface JobSlot {
  job: string
  count: number
}

export interface PartyDef {
  party: string
  size: number
  jobs: JobSlot[]
}

export interface SignupRow {
  id: number
  raid_id: number
  ign: string
  kind: 'participant' | 'buyer'
  job: string
  level: number
  party: string
  slot_job: string
  status: 'pending' | 'approved' | 'declined'
  reason: string
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export interface RaidRow {
  id: number
  boss: string
  scheduled_at: string
  duration_minutes: number
  min_level: number
  leader: string
  notes: string
  guide_url: string
  slots: PartyDef[]
  buyers_enabled: boolean
  buyer_price: number
  buyer_limit: number
  status: string
  created_by: string
  created_at: string
}

export interface RaidView extends RaidRow {
  signups: SignupRow[]
  totals: {
    participantSeats: number
    participantTaken: number
    buyerSeats: number
    buyerTaken: number
    closed: boolean
  }
}

export async function loadRaid(client: ReturnType<typeof getSupabaseAdmin>, id: number) {
  const { data } = await client.from('boss_raids').select('*').eq('id', id).maybeSingle<RaidRow>()
  return data ?? null
}

export function totalParticipantSeats(raid: Pick<RaidRow, 'slots'>) {
  return raid.slots.reduce((a, p) => a + p.size, 0)
}

/** Approved + pending signups of a kind — they occupy capacity until declined. */
export function takenOf(signups: SignupRow[], kind: 'participant' | 'buyer') {
  return signups.filter((s) => s.kind === kind && s.status !== 'declined').length
}

export function approvedInParty(signups: SignupRow[], party: string) {
  return signups.filter((s) => s.kind === 'participant' && s.status === 'approved' && s.party === party)
}

export function usedPartySeats(signups: SignupRow[], party: string) {
  return approvedInParty(signups, party).length
}

export function slotUsed(signups: SignupRow[], party: string, slotJob: string) {
  return signups.filter((s) => s.kind === 'participant' && s.status === 'approved' && s.party === party && s.slot_job === slotJob).length
}

export function jobSlotCount(raid: Pick<RaidRow, 'slots'>, party: string, slotJob: string) {
  return raid.slots.find((p) => p.party === party)?.jobs.find((j) => j.job === slotJob)?.count ?? 0
}

/**
 * Any seats left in a party: explicit "Any" job rows plus any seats not
 * claimed by a specific job, minus Any seats already allocated.
 */
export function spareAnySeats(def: PartyDef, signups: SignupRow[], party: string) {
  const anyCount = def.jobs.filter((j) => j.job === 'Any').reduce((a, j) => a + j.count, 0)
  const specific = def.jobs.filter((j) => j.job !== 'Any').reduce((a, j) => a + j.count, 0)
  const unclaimed = Math.max(0, def.size - specific)
  const anySeats = Math.max(anyCount, unclaimed)
  const usedAny = approvedInParty(signups, party).filter((s) => s.slot_job === 'Any').length
  return anySeats - usedAny
}

export function isSeatOpen(raid: Pick<RaidRow, 'slots'>, signups: SignupRow[], party: string, slotJob: string) {
  const def = raid.slots.find((p) => p.party === party)
  if (!def) return false
  if (usedPartySeats(signups, party) >= def.size) return false
  if (slotJob === 'Any') return spareAnySeats(def, signups, party) > 0
  return slotUsed(signups, party, slotJob) < jobSlotCount(raid, party, slotJob)
}

/** The party/job slots a character with this job can still take. */
export function openSlotsFor(raid: Pick<RaidRow, 'slots'>, signups: SignupRow[], charJob: string) {
  const open: Array<{ party: string; job: string }> = []
  for (const def of raid.slots) {
    if (usedPartySeats(signups, def.party) >= def.size) continue
    if (spareAnySeats(def, signups, def.party) > 0) open.push({ party: def.party, job: 'Any' })
    for (const j of def.jobs) {
      if (j.job === 'Any') continue
      if (jobQualifies(charJob, j.job) && slotUsed(signups, def.party, j.job) < j.count) {
        open.push({ party: def.party, job: j.job })
      }
    }
  }
  return open
}

/** What's still missing, phrased for the submitter (slots their job can't fill). */
export function blockedSlotsSummary(raid: Pick<RaidRow, 'slots'>, signups: SignupRow[], charJob: string) {
  const needed: Array<{ job: string; open: number }> = []
  for (const def of raid.slots) {
    for (const j of def.jobs) {
      if (jobQualifies(charJob, j.job)) continue
      const open = Math.max(0, j.count - slotUsed(signups, def.party, j.job))
      if (open > 0) {
        const existing = needed.find((n) => n.job === j.job)
        if (existing) existing.open += open
        else needed.push({ job: j.job, open })
      }
    }
  }
  return needed.map((n) => `${n.open}× ${n.job}`).join(', ') || null
}

/** Fetch all raids with the signups the requester may see. */
export async function listRaids(event: H3Event): Promise<{ raids: RaidView[] }> {
  const ctx: AuthContext = await getAuthContext(event)
  const client = getSupabaseAdmin()

  const { data: raids, error } = await client
    .from('boss_raids')
    .select('*')
    .order('scheduled_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const raidIds = (raids ?? []).map((r) => r.id)
  const { data: signups, error: signupError } = raidIds.length
    ? await client.from('raid_signups').select('*').in('raid_id', raidIds).order('created_at')
    : { data: [] as SignupRow[], error: null }

  if (signupError) throw createError({ statusCode: 500, statusMessage: signupError.message })

  const isAdmin = ctx.role === 'admin'
  const byRaid = new Map<number, SignupRow[]>()
  for (const s of signups ?? []) {
    const list = byRaid.get(s.raid_id) ?? []
    list.push(s)
    byRaid.set(s.raid_id, list)
  }

  const now = Date.now()
  return {
    raids: (raids ?? []).map((r) => {
      const all = byRaid.get(r.id) ?? []
      const visible = isAdmin
        ? all.filter((s) => s.status !== 'declined')
        : all.filter((s) => s.status === 'approved')
      const participantSeats = totalParticipantSeats(r)
      const participantTaken = takenOf(all, 'participant')
      const buyerSeats = r.buyer_limit > 0 ? r.buyer_limit : Number.POSITIVE_INFINITY
      const buyerTaken = takenOf(all, 'buyer')
      const past = new Date(r.scheduled_at).getTime() + r.duration_minutes * 60000 < now
      const closed = r.status !== 'scheduled' || past || participantTaken >= participantSeats

      return {
        ...r,
        signups: visible,
        totals: {
          participantSeats,
          participantTaken: Math.min(participantTaken, participantSeats),
          buyerSeats,
          buyerTaken,
          closed
        }
      }
    })
  }
}

export interface RaidPayload {
  boss: string
  scheduled_at: string
  duration_minutes: number
  min_level: number
  leader: string
  notes: string
  guide_url: string
  slots: PartyDef[]
  buyers_enabled: boolean
  buyer_price: number
  buyer_limit: number
  status?: string
}

/** Validate and normalize a raid payload from a jr master. */
export function validateRaidPayload(body: Record<string, unknown>): RaidPayload {
  const boss = String(body.boss ?? '').trim()
  if (!boss || boss.length > 40) {
    throw createError({ statusCode: 400, statusMessage: 'Boss name is required (max 40 chars)' })
  }

  const scheduled = new Date(String(body.scheduledAt ?? ''))
  if (Number.isNaN(scheduled.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Pick a valid start time (UTC)' })
  }

  const durationMinutes = Number(body.durationMinutes ?? 120)
  const minLevel = Number(body.minLevel ?? 1)
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 600) {
    throw createError({ statusCode: 400, statusMessage: 'Duration must be 15-600 minutes' })
  }
  if (!Number.isInteger(minLevel) || minLevel < 0 || minLevel > 300) {
    throw createError({ statusCode: 400, statusMessage: 'Min level must be 0-300' })
  }

  const guideUrl = String(body.guideUrl ?? '').trim()
  if (guideUrl && guideUrl.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Guide URL is too long' })
  }
  if (guideUrl && !/^https?:\/\/\S+$/i.test(guideUrl)) {
    throw createError({ statusCode: 400, statusMessage: 'Guide URL must start with http(s)://' })
  }

  const rawSlots = Array.isArray(body.slots) ? (body.slots as unknown[]) : []
  if (rawSlots.length === 0 || rawSlots.length > 10) {
    throw createError({ statusCode: 400, statusMessage: 'Set 1-10 parties' })
  }

  const slots: PartyDef[] = []
  for (const raw of rawSlots) {
    const party = String((raw as PartyDef).party ?? '').trim().slice(0, 40)
    const size = Number((raw as PartyDef).size ?? 6)
    const rawJobs = Array.isArray((raw as PartyDef).jobs) ? (raw as PartyDef).jobs : []
    if (!party) throw createError({ statusCode: 400, statusMessage: 'Every party needs a name' })
    if (!Number.isInteger(size) || size < 1 || size > 10) {
      throw createError({ statusCode: 400, statusMessage: 'Party size must be 1-10' })
    }
    if (rawJobs.length === 0 || rawJobs.length > 20) {
      throw createError({ statusCode: 400, statusMessage: `${party} needs at least one job row` })
    }
    const jobs: JobSlot[] = []
    let total = 0
    for (const rj of rawJobs) {
      const job = String((rj as JobSlot).job ?? '').trim()
      const count = Number((rj as JobSlot).count ?? 1)
      if (!SLOT_JOB_SET.has(job)) {
        throw createError({ statusCode: 400, statusMessage: `"${job}" is not a valid slot job` })
      }
      if (!Number.isInteger(count) || count < 1 || count > 10) {
        throw createError({ statusCode: 400, statusMessage: 'Slot count must be 1-10' })
      }
      jobs.push({ job, count })
      total += count
    }
    if (total > size) {
      throw createError({ statusCode: 400, statusMessage: `${party}: job slots (${total}) exceed party size (${size})` })
    }
    slots.push({ party, size, jobs })
  }

  const buyersEnabled = Boolean(body.buyersEnabled)
  const buyerPrice = Number(body.buyerPrice ?? 0)
  const buyerLimit = Number(body.buyerLimit ?? 0)
  if (!Number.isInteger(buyerPrice) || buyerPrice < 0 || buyerPrice > 2_147_483_647) {
    throw createError({ statusCode: 400, statusMessage: 'Buyer price must be a non-negative integer' })
  }
  if (!Number.isInteger(buyerLimit) || buyerLimit < 0 || buyerLimit > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Buyer limit must be 0-50' })
  }
  const status = body.status === 'cancelled' ? 'cancelled' : body.status === 'scheduled' ? 'scheduled' : undefined
  if (body.status !== undefined && !status) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid raid status' })
  }

  return {
    boss,
    scheduled_at: scheduled.toISOString(),
    duration_minutes: durationMinutes,
    min_level: minLevel,
    leader: String(body.leader ?? '').trim().slice(0, 40),
    notes: String(body.notes ?? '').trim().slice(0, 1000),
    guide_url: guideUrl,
    slots,
    buyers_enabled: buyersEnabled,
    buyer_price: buyersEnabled ? buyerPrice : 0,
    buyer_limit: buyersEnabled ? buyerLimit : 0,
    status
  }
}
