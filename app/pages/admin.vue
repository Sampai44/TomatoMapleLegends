<template>
  <section class="section">
    <div class="container-wide">
      <ToastStack />
      <h1 class="section-title">Admin — Raid Scheduling</h1>

      <div class="admin-grid">
        <div class="admin-col">
          <div class="card admin-card">
            <h2>{{ editingId ? 'Edit raid' : 'Schedule a raid' }}</h2>
            <form class="admin-form" @submit.prevent="saveRaid">
              <div class="form-row">
                <label>
                  Boss
                  <div class="boss-select" :class="{ open: bossOpen }">
                    <button type="button" class="boss-select-current" @click="toggleBoss">
                      <img
                        v-if="selectedBoss"
                        :src="selectedBoss.image"
                        :alt="selectedBoss.name"
                        class="boss-thumb"
                      />
                      <span class="boss-select-name">{{ selectedBoss?.name ?? form.boss || 'Pick a boss…' }}</span>
                      <span v-if="selectedBoss" class="boss-select-meta">{{ selectedBoss.levelLabel }}</span>
                      <span class="boss-caret">▾</span>
                    </button>
                    <div v-if="bossOpen" class="boss-menu" role="listbox">
                      <button
                        v-for="b in BOSSES"
                        :key="b.name"
                        type="button"
                        class="boss-option"
                        :class="{ active: form.boss === b.name }"
                        role="option"
                        @click="selectBoss(b)"
                      >
                        <img :src="b.image" :alt="b.name" class="boss-thumb" />
                        <span class="boss-option-body">
                          <span class="boss-option-name">{{ b.name }}</span>
                          <span class="boss-option-sub">{{ b.levelLabel }}</span>
                          <span class="boss-option-blurb">{{ b.blurb }}</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </label>
                <label>
                  Start time (UTC)
                  <input v-model="form.scheduledAtUtc" type="datetime-local" required />
                </label>
              </div>

              <div class="form-row">
                <label>
                  Duration (min)
                  <input v-model.number="form.durationMinutes" type="number" min="15" max="600" required />
                </label>
                <label>
                  Min level
                  <input v-model.number="form.minLevel" type="number" min="0" max="300" required />
                </label>
                <label>
                  Raid leader (IGN)
                  <input v-model="form.leader" maxlength="40" placeholder="e.g. Lactinated" />
                </label>
              </div>

              <label>
                Guide link
                <input v-model="form.guideUrl" type="url" maxlength="500" placeholder="https://…" />
              </label>

              <label>
                Notes
                <textarea v-model="form.notes" maxlength="1000" rows="2" placeholder="Bring apples, hold at the cave…" />
              </label>

              <div class="parties-editor">
                <div class="slots-head">
                  <span>Party</span>
                  <span>Size</span>
                  <span>Job slots</span>
                  <span />
                </div>
                <div v-for="(party, pi) in form.slots" :key="pi" class="party-row">
                  <input v-model="party.party" list="party-names" placeholder="Party 1" required />
                  <input v-model.number="party.size" type="number" min="1" max="10" required />
                  <div class="party-jobs">
                    <div v-for="(j, ji) in party.jobs" :key="ji" class="job-row">
                      <select v-model="j.job" required>
                        <option v-for="opt in SLOT_JOB_CHOICES" :key="opt" :value="opt">{{ opt }}</option>
                      </select>
                      <input v-model.number="j.count" type="number" min="1" max="10" required />
                      <button type="button" class="icon-btn" aria-label="Remove job slot" @click="removeJob(pi, ji)">×</button>
                    </div>
                    <button type="button" class="btn btn-cream btn-sm" @click="addJob(pi)">+ job slot</button>
                  </div>
                  <button type="button" class="icon-btn" aria-label="Remove party" @click="removeParty(pi)">×</button>
                </div>
                <datalist id="party-names">
                  <option value="Party 1" />
                  <option value="Party 2" />
                  <option value="Party 3" />
                </datalist>
                <button type="button" class="btn btn-cream" @click="addParty">+ Add party</button>
              </div>

              <div class="buyer-config">
                <label class="checkbox-label">
                  <input v-model="form.buyersEnabled" type="checkbox" />
                  Accept buyers
                </label>
                <label v-if="form.buyersEnabled">
                  Price (mesos)
                  <input v-model.number="form.buyerPrice" type="number" min="0" required />
                </label>
                <label v-if="form.buyersEnabled">
                  Buyer limit (0 = unlimited)
                  <input v-model.number="form.buyerLimit" type="number" min="0" max="50" required />
                </label>
              </div>

              <div class="form-actions">
                <button class="btn btn-red" type="submit">{{ editingId ? 'Save changes' : 'Schedule raid' }}</button>
                <button v-if="editingId" type="button" class="btn btn-outline" @click="resetForm">Cancel edit</button>
              </div>
            </form>
          </div>

          <div class="card admin-card">
            <h2>Scheduled raids</h2>
            <div v-if="!raids?.raids?.length" class="empty-state small">Nothing scheduled yet.</div>
            <ul class="raid-admin-list">
              <li v-for="r in raids?.raids ?? []" :key="r.id">
                <div class="raid-admin-info">
                  <strong>{{ r.boss }}</strong>
                  <span>{{ formatDateTime(r.scheduled_at) }}</span>
                  <span>{{ r.totals.participantTaken }}/{{ r.totals.participantSeats }} · {{ pendingFor(r) }} pending</span>
                  <span class="chip raid-chip" :class="r.status === 'cancelled' ? 'chip-cancelled' : ''">
                    {{ r.status === 'cancelled' ? 'Cancelled' : 'Scheduled' }}
                  </span>
                </div>
                <div class="raid-admin-actions">
                  <button class="btn btn-cream" @click="startEdit(r)">Edit</button>
                  <button class="btn btn-outline" @click="toggleCancel(r)">
                    {{ r.status === 'cancelled' ? 'Reopen' : 'Cancel' }}
                  </button>
                  <button class="btn btn-outline danger" @click="deleteRaid(r.id)">Delete</button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="admin-col">
          <div class="card admin-card">
            <h2>Signups pending review</h2>
            <div v-if="!pendingSignups.length" class="empty-state small">Nothing waiting for review.</div>
            <ul class="review-list">
              <li v-for="s in pendingSignups" :key="s.id" class="review-item">
                <div>
                  <strong>{{ s.ign }}</strong>
                  <span class="review-meta">
                    {{ s.kind === 'buyer' ? 'Buyer' : s.slot_job || 'Unallocated' }}
                    <template v-if="s.job"> · {{ s.job }} Lv{{ s.level }}</template>
                    <template v-if="s.level === 0"> · not in roster — verify in-game</template>
                  </span>
                  <span class="review-meta muted">→ {{ raidBoss(s.raid_id) }}</span>
                  <span class="review-meta muted">· submitted {{ formatTimestamp(s.created_at) }}</span>
                </div>

                <div v-if="s.kind === 'buyer'" class="review-actions">
                  <button class="btn btn-red" :disabled="busy === s.id" @click="approve(s)">Approve buyer</button>
                  <button class="btn btn-outline danger" :disabled="busy === s.id" @click="decline(s)">Decline</button>
                </div>

                <div v-else class="review-actions">
                  <div class="review-picks">
                    <select
                      :value="pick[s.id]?.party"
                      aria-label="Party"
                      @change="setPick(s.id, { party: ($event.target as HTMLSelectElement).value })"
                    >
                      <option value="" disabled>Party…</option>
                      <option v-for="p in raidParties(s)" :key="p" :value="p" :disabled="partyFull(s, p)">{{ p }}</option>
                    </select>
                    <select
                      :value="pick[s.id]?.job"
                      aria-label="Slot job"
                      @change="setPick(s.id, { job: ($event.target as HTMLSelectElement).value })"
                    >
                      <option value="" disabled>Slot…</option>
                      <option v-for="j in slotChoices(s)" :key="j" :value="j">{{ j }}</option>
                    </select>
                    <button class="btn btn-red" :disabled="busy === s.id || !pick[s.id]?.party" @click="approve(s)">
                      Approve
                    </button>
                  </div>
                  <div class="review-reject">
                    <input
                      v-model="reasons[s.id]"
                      type="text"
                      maxlength="500"
                      placeholder="Rejection reason (required to decline)…"
                    />
                    <button class="btn btn-outline danger" :disabled="busy === s.id || !reasons[s.id]?.trim()" @click="decline(s)">
                      Decline
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  useRaids,
  formatDateTime,
  formatTimestamp,
  type Raid,
  type Signup
} from '~/composables/useRaids'
import { SLOT_JOB_CHOICES, jobQualifies } from '#shared/jobs'
import { BOSSES, bossOf } from '#shared/bosses'
import { useToasts } from '~/composables/useToasts'

definePageMeta({ middleware: 'admin' })

useSeoMeta({
  title: 'Admin — Tomato Guild',
  ogTitle: 'Admin — Tomato Guild'
})

const { raids, refresh, approveSignup, declineSignup, createRaid, updateRaid, deleteRaid: deleteRaidApi } = useRaids()
const { showToast } = useToasts()
useRaidRealtime(refresh)

interface JobRow {
  job: string
  count: number
}
interface PartyRow {
  party: string
  size: number
  jobs: JobRow[]
}

const form = ref<{
  boss: string
  scheduledAtUtc: string
  durationMinutes: number
  minLevel: number
  leader: string
  notes: string
  guideUrl: string
  slots: PartyRow[]
  buyersEnabled: boolean
  buyerPrice: number
  buyerLimit: number
}>({
  boss: 'Horntail',
  scheduledAtUtc: '',
  durationMinutes: 120,
  minLevel: 140,
  leader: '',
  notes: '',
  guideUrl: '',
  slots: [{ party: 'Party 1', size: 6, jobs: [{ job: 'Any', count: 6 }] }],
  buyersEnabled: false,
  buyerPrice: 0,
  buyerLimit: 0
})
const editingId = ref<number | null>(null)

const bossOpen = ref(false)
const selectedBoss = computed(() => bossOf(form.value.boss))

function toggleBoss() {
  bossOpen.value = !bossOpen.value
}
function selectBoss(b: (typeof BOSSES)[number]) {
  form.value.boss = b.name
  form.value.minLevel = b.recommendedLevel
  bossOpen.value = false
}

function addParty() {
  form.value.slots.push({ party: `Party ${form.value.slots.length + 1}`, size: 6, jobs: [{ job: 'Any', count: 6 }] })
}
function removeParty(i: number) {
  form.value.slots.splice(i, 1)
}
function addJob(pi: number) {
  const jobs = form.value.slots[pi]?.jobs
  if (jobs) jobs.push({ job: 'Any', count: 1 })
}
function removeJob(pi: number, ji: number) {
  form.value.slots[pi]?.jobs.splice(ji, 1)
}

function resetForm() {
  editingId.value = null
  form.value = {
    boss: 'Horntail',
    scheduledAtUtc: '',
    durationMinutes: 120,
    minLevel: 140,
    leader: '',
    notes: '',
    guideUrl: '',
    slots: [{ party: 'Party 1', size: 6, jobs: [{ job: 'Any', count: 6 }] }],
    buyersEnabled: false,
    buyerPrice: 0,
    buyerLimit: 0
  }
}

/** datetime-local shows UTC: convert ISO <-> "YYYY-MM-DDTHH:mm" in UTC. */
function toUtcInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

function startEdit(r: Raid) {
  editingId.value = r.id
  form.value = {
    boss: r.boss,
    scheduledAtUtc: toUtcInput(r.scheduled_at),
    durationMinutes: r.duration_minutes,
    minLevel: r.min_level,
    leader: r.leader,
    notes: r.notes,
    guideUrl: r.guide_url,
    slots: r.slots.map((p) => ({ party: p.party, size: p.size, jobs: p.jobs.map((j) => ({ ...j })) })),
    buyersEnabled: r.buyers_enabled,
    buyerPrice: r.buyer_price,
    buyerLimit: r.buyer_limit
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function saveRaid() {
  const body = {
    boss: form.value.boss,
    scheduledAt: `${form.value.scheduledAtUtc}:00.000Z`,
    durationMinutes: form.value.durationMinutes,
    minLevel: form.value.minLevel,
    leader: form.value.leader,
    notes: form.value.notes,
    guideUrl: form.value.guideUrl,
    slots: form.value.slots,
    buyersEnabled: form.value.buyersEnabled,
    buyerPrice: form.value.buyerPrice,
    buyerLimit: form.value.buyerLimit
  }
  try {
    if (editingId.value) {
      await updateRaid(editingId.value, body)
      showToast('Raid updated')
    } else {
      await createRaid(body)
      showToast('Raid scheduled')
    }
    resetForm()
  } catch (e: any) {
    showToast(e?.data?.statusMessage ?? 'Failed to save raid', 'error')
  }
}

async function toggleCancel(r: Raid) {
  if (!confirm(r.status === 'cancelled' ? 'Reopen this raid for signups?' : 'Cancel this raid? Signups stay but the raid closes.')) return
  try {
    await updateRaid(r.id, {
      boss: r.boss,
      scheduledAt: r.scheduled_at,
      durationMinutes: r.duration_minutes,
      minLevel: r.min_level,
      leader: r.leader,
      notes: r.notes,
      guideUrl: r.guide_url,
      slots: r.slots,
      buyersEnabled: r.buyers_enabled,
      buyerPrice: r.buyer_price,
      buyerLimit: r.buyer_limit,
      status: r.status === 'cancelled' ? 'scheduled' : 'cancelled'
    })
    showToast(r.status === 'cancelled' ? 'Raid reopened' : 'Raid cancelled')
  } catch (e: any) {
    showToast(e?.data?.statusMessage ?? 'Failed to toggle raid', 'error')
  }
}

async function deleteRaid(id: number) {
  if (!confirm('Delete this raid and all its signups?')) return
  try {
    await deleteRaidApi(id)
    showToast('Raid deleted')
  } catch (e: any) {
    showToast(e?.data?.statusMessage ?? 'Failed to delete raid', 'error')
  }
}

const raidById = computed(() => new Map((raids.value?.raids ?? []).map((r) => [r.id, r])))

function raidBoss(raidId: number) {
  return raidById.value.get(raidId)?.boss ?? `raid #${raidId}`
}

const pendingSignups = computed<Signup[]>(() =>
  (raids.value?.raids ?? []).flatMap((r) => r.signups.filter((s) => s.status === 'pending'))
)

function raidOf(s: Signup) {
  return raidById.value.get(s.raid_id)
}

function raidParties(s: Signup) {
  return raidOf(s)?.slots.map((p) => p.party) ?? []
}

function partyFull(s: Signup, party: string) {
  const raid = raidOf(s)
  if (!raid) return true
  const def = raid.slots.find((p) => p.party === party)
  if (!def) return true
  const taken = raid.signups.filter((x) => x.party === party && x.status === 'approved').length
  return taken >= def.size
}

function slotChoices(s: Signup) {
  const raid = raidOf(s)
  const party = pick[s.id]?.party
  if (!raid || !party) return []
  const def = raid.slots.find((p) => p.party === party)
  if (!def) return []
  const approved = raid.signups.filter((x) => x.party === party && x.status === 'approved')
  const anyCount = def.jobs.filter((j) => j.job === 'Any').reduce((a, j) => a + j.count, 0)
  const specific = def.jobs.filter((j) => j.job !== 'Any').reduce((a, j) => a + j.count, 0)
  const anySeats = Math.max(anyCount, def.size - specific) - approved.filter((x) => x.slot_job === 'Any').length
  const choices = def.jobs.filter((j) => j.job !== 'Any' && jobQualifies(s.job || '', j.job)).map((j) => j.job)
  if (anySeats > 0) choices.push('Any')
  return choices
}

const pick = reactive<Record<number, { party: string; job: string }>>({})
const reasons = reactive<Record<number, string>>({})
const busy = ref<number | null>(null)

function setPick(id: number, patch: Partial<{ party: string; job: string }>) {
  pick[id] = { party: patch.party ?? pick[id]?.party ?? '', job: patch.job ?? pick[id]?.job ?? '' }
}async function approve(s: Signup) {
  if (s.kind === 'buyer') {
    busy.value = s.id
    try {
      await approveSignup(s.id, 'Buyers', 'Buyer')
      showToast(`${s.ign} approved as buyer`)
    } catch (e: any) {
      showToast(e?.data?.statusMessage ?? 'Failed to approve', 'error')
    } finally {
      busy.value = null
    }
    return
  }
  const p = pick[s.id]
  if (!p?.party) return
  busy.value = s.id
  try {
    await approveSignup(s.id, p.party, p.job || 'Any')
    showToast(`${s.ign} approved · ${p.party} · ${p.job || 'Any'}`)
  } catch (e: any) {
    showToast(e?.data?.statusMessage ?? 'Failed to approve', 'error')
  } finally {
    busy.value = null
  }
}

async function decline(s: Signup) {
  const reason = reasons[s.id]?.trim()
  if (!reason) return
  busy.value = s.id
  try {
    await declineSignup(s.id, reason)
    delete reasons[s.id]
    delete pick[s.id]
    showToast(`${s.ign} declined`)
  } catch (e: any) {
    showToast(e?.data?.statusMessage ?? 'Failed to decline', 'error')
  } finally {
    busy.value = null
  }
}

function pendingFor(r: Raid) {
  return r.signups.filter((s) => s.status === 'pending').length
}
</script>
