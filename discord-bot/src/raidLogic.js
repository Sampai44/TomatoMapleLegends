import { jobQualifies, isValidSlotJob, SLOT_JOB_SET } from './jobs.js'

/**
 * Pure raid seating logic, ported from `server/utils/raids.ts`.
 * The website and the bot share these rules so they always agree on who
 * fits where. HTTP/auth concerns are removed; the bot auths via Discord roles.
 */

export function totalParticipantSeats(raid) {
  return raid.slots.reduce((a, p) => a + p.size, 0)
}

export function takenOf(signups, kind) {
  return signups.filter((s) => s.kind === kind && s.status !== 'declined').length
}

export function approvedInParty(signups, party) {
  return signups.filter((s) => s.kind === 'participant' && s.status === 'approved' && s.party === party)
}

export function usedPartySeats(signups, party) {
  return approvedInParty(signups, party).length
}

export function slotUsed(signups, party, slotJob) {
  return signups.filter((s) => s.kind === 'participant' && s.status === 'approved' && s.party === party && s.slot_job === slotJob).length
}

export function jobSlotCount(raid, party, slotJob) {
  return raid.slots.find((p) => p.party === party)?.jobs.find((j) => j.job === slotJob)?.count ?? 0
}

export function spareAnySeats(def, signups, party) {
  const anyCount = def.jobs.filter((j) => j.job === 'Any').reduce((a, j) => a + j.count, 0)
  const specific = def.jobs.filter((j) => j.job !== 'Any').reduce((a, j) => a + j.count, 0)
  const unclaimed = Math.max(0, def.size - specific)
  const anySeats = Math.max(anyCount, unclaimed)
  const usedAny = approvedInParty(signups, party).filter((s) => s.slot_job === 'Any').length
  return anySeats - usedAny
}

export function isSeatOpen(raid, signups, party, slotJob) {
  const def = raid.slots.find((p) => p.party === party)
  if (!def) return false
  if (usedPartySeats(signups, party) >= def.size) return false
  if (slotJob === 'Any') return spareAnySeats(def, signups, party) > 0
  return slotUsed(signups, party, slotJob) < jobSlotCount(raid, party, slotJob)
}

export function openSlotsFor(raid, signups, charJob) {
  const open = []
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

/**
 * Reject a raid signup whose job can't fill any slot this raid needs.
 * Returns a human-readable summary of what's still missing, or null if the
 * character's job has at least one open slot.
 */
export function blockedSlotsSummary(raid, signups, charJob) {
  const needed = []
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

/**
 * Build the default party template for a size-N raid. Used when a jr master
 * creates a raid with `/raid create` and doesn't give explicit slots.
 */
export function defaultParties(partyCount, sizePerParty = 6) {
  return Array.from({ length: partyCount }, (_, i) => ({
    party: `Party ${i + 1}`,
    size: sizePerParty,
    jobs: []
  }))
}

/**
 * Parse a compact slot spec from the Discord command, e.g.
 *   "Party 1:6:1x Bishop,5x Any"
 * into the `slots` array shape the database expects.
 * Returns { slots, error } so the command can report a friendly message.
 */
export function parseSlots(raw) {
  if (!raw || String(raw).trim() === '') {
    return { slots: [], error: null }
  }
  const slots = []
  const segments = String(raw)
    .split(/\n|;|\|/i)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const segment of segments) {
    const seg = segment.split(':').map((s) => s.trim())
    const name = seg[0]
    if (!name) return { slots: [], error: `Couldn't read a party name from "${segment}"` }

    let size = 6
    let jobSpec = seg.slice(1).join(':').trim()
    if (seg.length >= 2 && /^\d+$/.test(seg[1])) {
      size = Number(seg[1])
      jobSpec = seg.slice(2).join(':').trim()
    }
    if (!Number.isInteger(size) || size < 1 || size > 10) {
      return { slots: [], error: `Party "${name}" size must be 1-10` }
    }

    let jobs = []
    if (jobSpec) {
      for (const chunk of jobSpec.split(',')) {
        const m = chunk.trim().match(/^(\d+)\s*[xX*]\s*(.+)$/)
        if (!m) return { slots: [], error: `Bad job row "${chunk.trim()}" in "${name}"` }
        const count = Number(m[1])
        const job = m[2].trim()
        if (!SLOT_JOB_SET.has(job)) return { slots: [], error: `"${job}" is not a valid slot job` }
        if (!Number.isInteger(count) || count < 1 || count > 10) {
          return { slots: [], error: `Slot count for ${job} must be 1-10` }
        }
        jobs.push({ job, count })
      }
      const total = jobs.reduce((a, j) => a + j.count, 0)
      if (total > size) return { slots: [], error: `${name}: job slots (${total}) exceed party size (${size})` }
    }
    slots.push({ party: name, size, jobs })
  }
  return { slots, error: null }
}

/** Validate + normalize a raid payload. Throws a human-readable Error on bad input. */
export function validateRaidPayload(body) {
  const boss = String(body.boss ?? '').trim()
  if (!boss || boss.length > 40) throw new Error('Boss name is required (max 40 chars)')

  const scheduled = new Date(String(body.scheduledAt ?? ''))
  if (isNaN(scheduled.getTime())) throw new Error('Pick a valid start time (UTC)')

  const durationMinutes = Number(body.durationMinutes ?? 120)
  const minLevel = Number(body.minLevel ?? 1)
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 600) throw new Error('Duration must be 15-600 minutes')
  if (!Number.isInteger(minLevel) || minLevel < 0 || minLevel > 300) throw new Error('Min level must be 0-300')

  const guideUrl = String(body.guideUrl ?? '').trim()
  if (guideUrl && guideUrl.length > 500) throw new Error('Guide URL is too long')
  if (guideUrl && !/^https?:\/\/\S+$/i.test(guideUrl)) throw new Error('Guide URL must start with http(s)://')

  const rawSlots = Array.isArray(body.slots) ? body.slots : []
  if (rawSlots.length === 0 || rawSlots.length > 10) throw new Error('Set 1-10 parties')

  const slots = []
  for (const raw of rawSlots) {
    const party = String(raw.party ?? '').trim().slice(0, 40)
    const size = Number(raw.size ?? 6)
    const rawJobs = Array.isArray(raw.jobs) ? raw.jobs : []
    if (!party) throw new Error('Every party needs a name')
    if (!Number.isInteger(size) || size < 1 || size > 10) throw new Error('Party size must be 1-10')
    if (rawJobs.length === 0 || rawJobs.length > 20) throw new Error(`${party} needs at least one job row`)
    const jobs = []
    let total = 0
    for (const rj of rawJobs) {
      const job = String(rj.job ?? '').trim()
      const count = Number(rj.count ?? 1)
      if (!SLOT_JOB_SET.has(job)) throw new Error(`"${job}" is not a valid slot job`)
      if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('Slot count must be 1-10')
      jobs.push({ job, count })
      total += count
    }
    if (total > size) throw new Error(`${party}: job slots (${total}) exceed party size (${size})`)
    slots.push({ party, size, jobs })
  }

  const buyersEnabled = Boolean(body.buyersEnabled)
  const buyerPrice = Number(body.buyerPrice ?? 0)
  const buyerLimit = Number(body.buyerLimit ?? 0)
  if (!Number.isInteger(buyerPrice) || buyerPrice < 0 || buyerPrice > 2147483647) throw new Error('Buyer price must be a non-negative integer')
  if (!Number.isInteger(buyerLimit) || buyerLimit < 0 || buyerLimit > 50) throw new Error('Buyer limit must be 0-50')

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
    buyer_limit: buyersEnabled ? buyerLimit : 0
  }
}