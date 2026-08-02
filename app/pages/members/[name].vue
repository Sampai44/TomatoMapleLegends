<template>
  <section class="section">
    <div class="container-wide">
      <NuxtLink to="/roster" style="font-weight: 800">&larr; Back to roster</NuxtLink>

      <div v-if="pending" class="skeleton table" style="margin-top: 16px" />

      <div v-else-if="error || !data" class="card empty-state" style="margin-top: 16px">
        Member not found.
      </div>

      <template v-else>
        <div class="card member-head" style="margin-top: 16px">
          <div class="member-avatar">
            <img :src="data.member.avatar_url ?? undefined" :alt="data.member.char_name" />
          </div>
          <div class="member-meta">
            <h1>
              {{ data.member.char_name }}
            </h1>
            <p style="margin: 0 0 16px; color: var(--ink-soft); font-weight: 700">
              {{ data.member.job }}
            </p>
            <div class="member-stats">
              <div class="card stat-card">
                <div class="stat-value">Lv {{ data.member.level }}</div>
                <div class="stat-label">Level</div>
              </div>
              <div class="card stat-card">
                <div class="stat-value">{{ data.member.exp }}%</div>
                <div class="stat-label">Exp</div>
              </div>
              <div class="card stat-card">
                <div class="stat-value">{{ data.member.fame.toLocaleString() }}</div>
                <div class="stat-label">Fame</div>
              </div>
              <div class="card stat-card">
                <div class="stat-value">{{ data.member.guild_rank }}</div>
                <div class="stat-label">Guild Rank</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card history-card" style="margin-top: 20px">
          <h2 class="section-title" style="margin-bottom: 16px">Level History</h2>
          <svg
            v-if="history.length > 1"
            :viewBox="`0 0 ${W} ${H}`"
            style="width: 100%; height: auto; display: block"
            role="img"
            aria-label="Level history chart for {{ data.member.char_name }}"
          >
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#e23d28" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#e23d28" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <path :d="areaPath" fill="url(#area)" />
            <path :d="linePath" fill="none" stroke="#e23d28" stroke-width="3" stroke-linecap="round" />
            <circle v-for="pt in points" :key="pt.key" :cx="pt.x" :cy="pt.y" r="4" fill="#fff" stroke="#b92c1a" stroke-width="2.5" />
          </svg>
          <div v-else class="history-empty">
            No level changes recorded yet &mdash; history builds up as the daily sync runs.
          </div>
          <p class="history-note">
            {{ history.length }} snapshot(s) &middot;
            {{ formatDate(data.member.first_seen) }} &rarr; {{ formatDate(data.member.last_seen) }} &middot;
            <a :href="`https://legends.ml${data.member.legends_url}`" target="_blank" rel="noopener">
              View on legends.ml
            </a>
          </p>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMemberDetail, formatDate } from '~/composables/useGuildData'

const route = useRoute()
const name = String(route.params.name ?? '')
const { data, pending, error } = useMemberDetail(name)

useSeoMeta({
  title: () => `${name} — Tomato Guild`,
  ogTitle: () => `${name} — Tomato Guild`
})

const W = 800
const H = 220
const PAD = 30

const history = computed(() => data.value?.history ?? [])

const points = computed(() => {
  const levels = history.value
  if (levels.length < 2) return []
  const min = Math.min(...levels.map((l) => l.level))
  const max = Math.max(...levels.map((l) => l.level))
  const span = Math.max(max - min, 1)
  const usableW = W - PAD * 2
  const usableH = H - PAD * 2
  return levels.map((l, i) => ({
    key: `${i}-${l.snapshot_at}`,
    x: PAD + (i / (levels.length - 1)) * usableW,
    y: PAD + usableH - ((l.level - min) / span) * usableH
  }))
})

const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
)

const areaPath = computed(() => {
  const pts = points.value
  if (pts.length < 2) return ''
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return ''
  return `${linePath.value} L${last.x.toFixed(1)},${H - PAD} L${first.x.toFixed(1)},${H - PAD} Z`
})
</script>
