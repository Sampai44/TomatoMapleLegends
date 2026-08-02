<template>
  <section class="section">
    <div class="container-wide">
      <h1 class="section-title">Boss Raids</h1>
      <p class="section-sub">No account needed — sign up with your in-game name. A jr master reviews and allocates you to a party.</p>

      <div v-if="pending" class="skeleton table" />
      <div v-else-if="error" class="card empty-state">Couldn't load raids.</div>

      <template v-else>
        <div v-if="orderedRaids.length === 0" class="card empty-state">
          No raids scheduled yet — check back soon!
        </div>

        <div class="raid-list">
          <article
            v-for="raid in orderedRaids"
            :key="raid.id"
            class="card raid-card"
            :class="{ 'raid-past': isPast(raid) }"
          >
            <header class="raid-head">
              <img
                v-if="bossName(raid.boss)"
                :src="bossName(raid.boss).image"
                :alt="raid.boss"
                class="raid-boss-art"
              />
              <div class="raid-head-text">
                <div class="raid-title-row">
                  <h2 class="raid-boss">{{ raid.boss }}</h2>
                  <span v-if="bossName(raid.boss)" class="chip raid-chip boss-lv">{{ bossName(raid.boss).levelLabel }}</span>
                </div>
                <p class="raid-meta">
                  {{ formatDateTime(raid.scheduled_at) }}
                  <span class="dot-sep">·</span>
                  ~{{ raid.duration_minutes }} min
                  <span v-if="raid.leader" class="dot-sep">·</span>
                  <span v-if="raid.leader">led by {{ raid.leader }}</span>
                </p>
              </div>
              <div class="raid-badges">
                <span class="chip raid-chip">Lv {{ raid.min_level }}+</span>
                <span class="chip raid-chip" :class="raidStatusClass(raid)">
                  {{ raidStatusLabel(raid) }}
                </span>
              </div>
            </header>

            <p v-if="raid.notes" class="raid-notes">{{ raid.notes }}</p>
            <p v-if="raid.guide_url" class="raid-notes">
              <a :href="raid.guide_url" target="_blank" rel="noopener" class="guide-link">Boss guide ↗</a>
            </p>

            <div class="party-board">
              <div v-for="party in partiesOf(raid)" :key="party" class="party-col">
                <h3 class="party-title">
                  {{ party }}
                  <span class="party-fill">{{ partyTaken(raid, party) }}/{{ partySize(raid, party) }}</span>
                </h3>
                <div v-for="def in slotsOf(raid, party)" :key="def.job" class="slot-card">
                  <div class="slot-head">
                    <span class="slot-job">{{ def.job }}</span>
                    <span class="slot-count">{{ filledFor(raid, party, def.job) }}/{{ def.count }}</span>
                  </div>
                  <div class="slot-bar">
                    <div
                      class="slot-bar-fill"
                      :class="{ full: filledFor(raid, party, def.job) >= def.count }"
                      :style="{ width: Math.min(100, (filledFor(raid, party, def.job) / def.count) * 100) + '%' }"
                    />
                  </div>
                  <ul class="slot-names">
                    <li v-for="s in signupsIn(raid, party, def.job)" :key="s.id">
                      {{ s.ign }}
                      <span v-if="s.job && s.job !== def.job" class="job-tag">{{ s.job }} Lv{{ s.level }}</span>
                    </li>
                    <li v-if="signupsIn(raid, party, def.job).length === 0" class="empty-slot">open</li>
                  </ul>
                </div>
              </div>
            </div>

            <div v-if="raid.buyers_enabled" class="buyer-strip">
              <span class="buyer-title">Buyers</span>
              <span>{{ raid.totals.buyerTaken }}{{ raid.buyer_limit ? ' / ' + raid.buyer_limit : '' }}</span>
              <span class="dot-sep">·</span>
              <span>paid spots</span>
              <span v-if="raid.buyer_price > 0" class="dot-sep">·</span>
              <span v-if="raid.buyer_price > 0" class="buyer-price">{{ raid.buyer_price.toLocaleString() }} mesos</span>
              <ul v-if="buyersOf(raid).length" class="buyer-names">
                <li v-for="b in buyersOf(raid)" :key="b.id">{{ b.ign }}</li>
              </ul>
            </div>

            <div v-if="raid.drops.length || raid.split.attackers" class="loot-public">
              <div class="loot-pub-head">
                <span class="loot-pub-title">Loot split</span>
                <span class="chip raid-chip boss-lv">{{ raid.split.attackers }} attacker{{ raid.split.attackers === 1 ? '' : 's' }}</span>
              </div>
              <div class="loot-pub-stats">
                <span class="loot-pub-stat">
                  <strong>{{ mesos(raid.split.totalValue) }}</strong>
                  <small>total</small>
                </span>
                <span class="loot-pub-stat">
                  <strong>{{ mesos(raid.split.soldPerAttacker) }}</strong>
                  <small>paid each</small>
                </span>
                <span class="loot-pub-stat">
                  <strong>{{ mesos(raid.split.pendingPerAttacker) }}</strong>
                  <small>remaining each</small>
                </span>
                <span class="loot-pub-stat">
                  <strong>{{ raid.split.pendingCount }}</strong>
                  <small>listed</small>
                </span>
              </div>
              <ul v-if="raid.drops.length" class="drop-pub-list">
                <li v-for="d in raid.drops" :key="d.id" class="drop-pub-row">
                  <span class="drop-pub-item">{{ d.item }}</span>
                  <span class="chip raid-chip" :class="'drop-' + d.disposition">{{ DROP_SHORT[d.disposition] }}</span>
                  <template v-if="d.disposition === 'sold'">
                    <span class="muted">sold {{ mesos(d.sold_price) }}</span>
                    <span v-if="d.sold_to" class="muted">→ {{ d.sold_to }}</span>
                    <span class="muted">+{{ mesos(perShare(raid, d.sold_price)) }} each</span>
                  </template>
                  <template v-else-if="d.disposition === 'fm'">
                    <span class="muted">listed {{ mesos(d.price) }}</span>
                    <span v-if="d.sold_to" class="muted">→ {{ d.sold_to }}</span>
                    <span class="muted">+{{ mesos(perShare(raid, d.price)) }} each if sold</span>
                  </template>
                  <template v-else-if="d.disposition === 'kept'">
                    <span class="muted">kept by {{ d.kept_by || raid.leader || 'leader' }}</span>
                  </template>
                  <template v-else>
                    <span class="muted">not yet decided</span>
                  </template>
                </li>
              </ul>
            </div>

            <footer class="raid-foot">
              <template v-if="mySignups[raid.id]?.length">
                <div class="my-signup">
                  <span
                    v-for="s in mySignups[raid.id]"
                    :key="s.id"
                    class="signup-pos"
                  >
                    {{ s.ign }} · {{ s.party || s.kind }} · {{ s.slot_job || '—' }}
                    <span class="chip raid-chip" :class="'chip-' + s.status">{{ SIGNUP_LABEL[s.status] }}</span>
                    <span class="muted">submitted {{ formatTimestamp(s.created_at) }}</span>
                    <span v-if="s.status === 'declined' && s.reason" class="reject-reason">— {{ s.reason }}</span>
                  </span>
                  <button
                    v-if="!isPast(raid) && raid.status === 'scheduled' && myActive(raid.id)"
                    class="btn btn-cream"
                    @click="withdrawSignup(raid)"
                  >
                    Withdraw
                  </button>
                </div>
              </template>

              <template v-if="!canSignup(raid)">
                <span class="muted">
                  {{
                    raid.status === 'cancelled'
                      ? 'Cancelled'
                      : isPast(raid)
                        ? 'Signups closed — raid has passed'
                        : raidFull(raid)
                          ? 'Expedition is full'
                          : 'Signups closed'
                  }}
                </span>
              </template>

              <form v-else class="signup-form" @submit.prevent="submitSignup(raid)">
                <input
                  v-model="formOf(raid.id).ign"
                  type="text"
                  maxlength="20"
                  placeholder="Your IGN"
                  aria-label="In-game name"
                  required
                />
                <select v-model="formOf(raid.id).kind" aria-label="Sign up as">
                  <option value="participant">Participant</option>
                  <option v-if="raid.buyers_enabled" value="buyer">Buyer ({{ raid.buyer_price.toLocaleString() }} mesos)</option>
                </select>
                <button class="btn btn-red" type="submit" :disabled="signingUp === raid.id">
                  {{ signingUp === raid.id ? 'Signing up…' : 'Sign up' }}
                </button>
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  :disabled="lookingUp === raid.id"
                  @click="checkStatus(raid)"
                >
                  {{ lookingUp === raid.id ? '…' : 'My status' }}
                </button>
              </form>
              <p v-if="errors[raid.id]" class="form-error">{{ errors[raid.id] }}</p>
              <p v-if="okays[raid.id]" class="form-ok">{{ okays[raid.id] }}</p>
            </footer>
          </article>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  useRaids,
  formatDateTime,
  formatTimestamp,
  mesos,
  filledFor,
  raidFull,
  SIGNUP_LABEL,
  type Raid,
  type Signup
} from '~/composables/useRaids'
import { bossOf } from '#shared/bosses'

const DROP_SHORT: Record<string, string> = {
  sold: 'Sold',
  fm: 'FM',
  kept: 'Kept',
  unsold: 'Undecided'
}

function perShare(raid: Raid, amount: number) {
  return raid.split.attackers > 0 ? Math.floor(amount / raid.split.attackers) : 0
}

useSeoMeta({
  title: 'Boss Raids — Tomato Guild',
  ogTitle: 'Boss Raids — Tomato Guild'
})

function bossName(raw: string) {
  return bossOf(raw)
}

const { raids, pending, error, refresh, signUp, withdraw } = useRaids()
useRaidRealtime(refresh)

const signingUp = ref<number | null>(null)
const lookingUp = ref<number | null>(null)
const forms = reactive<Record<number, { ign: string; kind: 'participant' | 'buyer' }>>({})
const mySignups = reactive<Record<number, Signup[]>>({})
const errors = reactive<Record<number, string>>({})
const okays = reactive<Record<number, string>>({})

function formOf(raidId: number) {
  return (forms[raidId] ??= { ign: '', kind: 'participant' })
}

const orderedRaids = computed(() =>
  [...(raids?.value?.raids ?? [])].sort((a, b) => {
    const aPast = isPast(a)
    const bPast = isPast(b)
    if (aPast !== bPast) return aPast ? 1 : -1
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  })
)

function isPast(raid: Raid) {
  return new Date(raid.scheduled_at).getTime() + raid.duration_minutes * 60000 < Date.now()
}

function partiesOf(raid: Raid) {
  return [...new Set(raid.slots.map((s) => s.party))]
}

function slotsOf(raid: Raid, party: string) {
  return raid.slots.find((p) => p.party === party)?.jobs ?? []
}

function signupsIn(raid: Raid, party: string, job: string) {
  return raid.signups.filter((s) => s.party === party && s.slot_job === job)
}

function buyersOf(raid: Raid) {
  return raid.signups.filter((s) => s.kind === 'buyer' && s.status === 'approved')
}

function partySize(raid: Raid, party: string) {
  return raid.slots.find((p) => p.party === party)?.size ?? 0
}

function partyTaken(raid: Raid, party: string) {
  return raid.signups.filter((s) => s.party === party && s.status === 'approved').length
}

function myActive(raidId: number) {
  return (mySignups[raidId] ?? []).some((s) => s.status === 'pending' || s.status === 'approved')
}

function canSignup(raid: Raid) {
  return raid.status === 'scheduled' && !isPast(raid) && !raidFull(raid)
}

function raidStatusLabel(raid: Raid) {
  if (raid.status === 'cancelled') return 'Cancelled'
  if (raidFull(raid)) return 'Full'
  return 'Open'
}

function raidStatusClass(raid: Raid) {
  if (raid.status === 'cancelled') return 'chip-cancelled'
  if (raidFull(raid)) return 'chip-full'
  return 'chip-open'
}

async function checkStatus(raid: Raid) {
  const ign = formOf(raid.id).ign.trim()
  if (!ign) return
  lookingUp.value = raid.id
  errors[raid.id] = ''
  try {
    const { signups } = await $fetch<{ signups: Signup[] }>(`/api/raids/${raid.id}/signups?ign=${encodeURIComponent(ign)}`)
    mySignups[raid.id] = signups
    if (!signups.length) okays[raid.id] = `No signup found for ${ign} on this raid.`
    else delete okays[raid.id]
  } catch (e: any) {
    errors[raid.id] = e?.data?.statusMessage ?? 'Failed to look up'
  } finally {
    lookingUp.value = null
  }
}

async function submitSignup(raid: Raid) {
  const form = formOf(raid.id)
  if (!form.ign) return
  signingUp.value = raid.id
  errors[raid.id] = ''
  okays[raid.id] = ''
  try {
    await signUp(raid.id, form.ign, form.kind)
    okays[raid.id] = `${form.ign} submitted — a jr master will review it.`
    await checkStatus(raid)
  } catch (e: any) {
    errors[raid.id] = e?.data?.statusMessage ?? e?.message ?? 'Failed to sign up'
  } finally {
    signingUp.value = null
  }
}

async function withdrawSignup(raid: Raid) {
  const ign = formOf(raid.id).ign.trim()
  errors[raid.id] = ''
  okays[raid.id] = ''
  try {
    await withdraw(raid.id, ign)
    await checkStatus(raid)
  } catch (e: any) {
    errors[raid.id] = e?.data?.statusMessage ?? 'Failed to withdraw'
  }
}
</script>
