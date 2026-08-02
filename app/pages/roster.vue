<template>
  <section class="section">
    <div class="container-wide">
      <h1 class="section-title">Roster</h1>

      <div v-if="pending" class="skeleton table" />

      <div v-else-if="error || !members?.members" class="card empty-state">
        Couldn't load the roster. Is Supabase configured? Check
        <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>.
      </div>

      <template v-else>
        <div class="toolbar">
          <input
            v-model="query"
            type="search"
            placeholder="Search by character name..."
            aria-label="Search members"
          />
          <select v-model="sort" aria-label="Sort members">
            <option value="level">Sort by level</option>
            <option value="fame">Sort by fame</option>
            <option value="char_name">Sort by name</option>
            <option value="guild_rank">Sort by guild rank</option>
          </select>
          <button class="btn btn-cream" @click="toggleOrder" aria-label="Toggle sort order">
            {{ order === 'desc' ? 'Highest first' : 'Lowest first' }}
          </button>
        </div>

        <div class="chips" style="margin-bottom: 18px">
          <button
            class="chip"
            :class="{ active: rank === '' }"
            @click="setRank('')"
          >
            All ranks <span class="count">({{ members.members.length }})</span>
          </button>
          <button
            v-for="(r, key) in rankCounts"
            :key="key"
            class="chip"
            :class="{ active: rank === key }"
            @click="setRank(key)"
          >
            {{ key }} <span class="count">({{ r }})</span>
          </button>
        </div>

        <div class="chips" style="margin-bottom: 18px">
          <button
            class="chip"
            :class="{ active: branch === '' }"
            @click="branch = ''"
          >
            All <span class="count">({{ members.members.length }})</span>
          </button>
          <button
            v-for="(label, key) in branchCounts"
            :key="key"
            class="chip"
            :class="{ active: branch === key }"
            @click="branch = key"
          >
            {{ label.label }} <span class="count">({{ label.count }})</span>
          </button>
        </div>

        <div class="card table-wrap">
          <table class="roster-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Job</th>
                <th>Level</th>
                <th>Fame</th>
                <th>Guild Rank</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in visibleMembers" :key="m.char_name">
                <td>
                  <NuxtLink
                    :to="`/members/${encodeURIComponent(m.char_name)}`"
                    class="cell-name"
                  >
                    <span class="avatar-thumb">
                      <img :src="m.avatar_url ?? undefined" :alt="m.char_name" loading="lazy" />
                    </span>
                    <span style="font-weight: 900">
                      {{ m.char_name }}
                    </span>
                  </NuxtLink>
                </td>
                <td>
                  <span style="font-weight: 700">{{ m.job }}</span>
                </td>
                <td>
                  <span class="level-cell">Lv {{ m.level }}</span>
                  <span v-if="m.exp > 0" class="exp-cell"> &middot; {{ m.exp }}%</span>
                </td>
                <td style="font-weight: 800">{{ m.fame.toLocaleString() }}</td>
                <td>
                  <span class="rank-chip" :class="rankClass(m.guild_rank)">
                    {{ m.guild_rank }}
                  </span>
                </td>
              </tr>
              <tr v-if="visibleMembers.length === 0">
                <td colspan="5" class="empty-state">No tomatoes match that search.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGuildMembers, BRANCH_LABELS } from '~/composables/useGuildData'

useSeoMeta({
  title: 'Roster — Tomato Guild',
  ogTitle: 'Roster — Tomato Guild'
})

const { members, pending, error, refresh } = useGuildMembers()
useMemberRealtime(refresh)

const query = ref('')
const branch = ref('')
const rank = ref('')
const sort = ref('level')
const order = ref('desc')

const route = useRoute()
const router = useRouter()

const RANK_ORDER = ['Master', 'Jr. Master', 'Senior Master', 'Jr. Senior Master', 'Member'] as const

if (typeof route.query.rank === 'string') rank.value = route.query.rank

function setRank(r: string) {
  rank.value = r
  router.replace({ query: { ...route.query, rank: r || undefined } })
}

function toggleOrder() {
  order.value = order.value === 'desc' ? 'asc' : 'desc'
}

const rankCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const m of members.value?.members ?? []) {
    counts[m.guild_rank] = (counts[m.guild_rank] ?? 0) + 1
  }
  return counts
})

const branchCounts = computed(() => {
  const counts: Record<string, { label: string; count: number }> = {}
  for (const m of members.value?.members ?? []) {
    const key = m.job_branch || 'beginner'
    const entry = (counts[key] ??= { label: BRANCH_LABELS[key] ?? key, count: 0 })
    entry.count++
  }
  return counts
})

const visibleMembers = computed(() => {
  const roster = members.value?.members ?? []
  const q = query.value.trim().toLowerCase()
  const filtered = roster.filter((m) => {
    if (branch.value && m.job_branch !== branch.value) return false
    if (rank.value && m.guild_rank !== rank.value) return false
    if (q && !m.char_name.toLowerCase().includes(q)) return false
    return true
  })

  const dir = order.value === 'asc' ? 1 : -1
  const key = sort.value as 'level' | 'fame' | 'char_name' | 'guild_rank'
  const rankWeight: Record<string, number> = {
    Master: 5,
    'Jr. Master': 4,
    'Senior Master': 3,
    'Jr. Senior Master': 2,
    Member: 1
  }
  return [...filtered].sort((a, b) => {
    if (key === 'guild_rank') {
      return ((rankWeight[a.guild_rank] ?? 0) - (rankWeight[b.guild_rank] ?? 0)) * dir
    }
    const av = a[key]
    const bv = b[key]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
})

watch(query, () => {
  sort.value = 'char_name'
})

function rankClass(rank: string) {
  const r = rank.toLowerCase()
  if (r.startsWith('jr')) return 'jr-master'
  if (r.includes('master')) return 'master'
  if (r.includes('senior')) return 'senior'
  return 'member'
}
</script>
