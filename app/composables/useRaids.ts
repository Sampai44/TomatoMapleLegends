import { jobQualifies } from '#shared/jobs'

export interface JobSlot {
  job: string
  count: number
}

export interface PartyDef {
  party: string
  size: number
  jobs: JobSlot[]
}

export interface Signup {
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

export interface Raid {
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
  created_at: string
  signups: Signup[]
  totals: {
    participantSeats: number
    participantTaken: number
    buyerSeats: number
    buyerTaken: number
    closed: boolean
  }
}

export interface RaidPayload {
  boss: string
  scheduledAt: string
  durationMinutes: number
  minLevel: number
  leader: string
  notes: string
  guideUrl: string
  slots: PartyDef[]
  buyersEnabled: boolean
  buyerPrice: number
  buyerLimit: number
  status?: 'scheduled' | 'cancelled'
}

export function useRaids() {
  const { data: raids, pending, error, refresh } = useFetch<{ raids: Raid[] }>('/api/raids')

  async function signUp(raidId: number, ign: string, kind: 'participant' | 'buyer') {
    await $fetch(`/api/raids/${raidId}/signup`, { method: 'POST', body: { ign, kind } })
    await refresh()
  }

  async function withdraw(raidId: number, ign: string) {
    await $fetch(`/api/raids/${raidId}/signup`, { method: 'DELETE', body: { ign } })
    await refresh()
  }

  async function approveSignup(id: number, party: string, slotJob: string) {
    await $fetch(`/api/admin/signups/${id}/approve`, { method: 'POST', body: { party, slotJob } })
    await refresh()
  }

  async function declineSignup(id: number, reason: string) {
    await $fetch(`/api/admin/signups/${id}/decline`, { method: 'POST', body: { reason } })
    await refresh()
  }

  async function createRaid(payload: RaidPayload) {
    await $fetch('/api/admin/raids', { method: 'POST', body: payload })
    await refresh()
  }

  async function updateRaid(id: number, payload: RaidPayload) {
    await $fetch(`/api/admin/raids/${id}`, { method: 'PUT', body: payload })
    await refresh()
  }

  async function deleteRaid(id: number) {
    await $fetch(`/api/admin/raids/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return { raids, pending, error, refresh, signUp, withdraw, approveSignup, declineSignup, createRaid, updateRaid, deleteRaid }
}

/** Seats taken (approved) per (party, job) key. */
export function fillMap(raid: Raid, scope: 'public' | 'admin' = 'public') {
  const map = new Map<string, number>()
  for (const s of raid.signups) {
    if (scope === 'public' && s.status !== 'approved') continue
    const key = `${s.party}\u0000${s.slot_job}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function filledFor(raid: Raid, party: string, job: string, scope: 'public' | 'admin' = 'public') {
  return raid.signups.filter((s) => s.party === party && s.slot_job === job && (scope === 'admin' || s.status === 'approved')).length
}

export function partyFilled(raid: Raid, party: string, scope: 'public' | 'admin' = 'public') {
  const def = raid.slots.find((p) => p.party === party)
  if (!def) return false
  return filledFor(raid, party, 'Any', scope) + raid.slots
    .filter((p) => p.party === party)
    .flatMap((p) => p.jobs.filter((j) => j.job !== 'Any'))
    .reduce((a, j) => a + filledFor(raid, party, j.job, scope), 0) >= def.size
}

export function isOpen(raid: Raid, party: string, job: string) {
  const def = raid.slots.find((p) => p.party === party)
  if (!def) return false
  if (raid.totals.closed) return false
  const filled = filledFor(raid, party, job)
  if (job === 'Any') {
    const totalFilled = def.jobs.reduce((a, j) => a + filledFor(raid, party, j.job), 0)
    return totalFilled < def.size
  }
  const cap = def.jobs.find((j) => j.job === job)?.count ?? 0
  return cap > 0 && filled < cap
}

/** Open slots that accept this job (per-party). */
export function qualifyingOpenSlots(raid: Raid, charJob: string) {
  const open: Array<{ party: string; job: string }> = []
  for (const def of raid.slots) {
    for (const j of def.jobs) {
      if (j.job === 'Any' || jobQualifies(charJob, j.job)) {
        if (isOpen(raid, def.party, j.job)) open.push({ party: def.party, job: j.job })
      }
    }
  }
  return open
}

/** Display in server time: UTC (GMT+0) — never the visitor's local zone. */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  }) + ' UTC'
}

/** Compact server-time display (UTC) for timestamps like submission times. */
export function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  }) + ' UTC'
}

export function raidFull(raid: Raid) {
  return raid.totals.participantTaken >= raid.totals.participantSeats
}

export function totalSlots(raid: Raid) {
  return raid.totals.participantSeats
}

export const SIGNUP_LABEL: Record<Signup['status'], string> = {
  pending: 'Pending review',
  approved: 'Approved',
  declined: 'Declined'
}
