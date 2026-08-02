<template>
  <div>
    <section class="hero">
      <div class="container-wide hero-inner">
        <span class="hero-tag">A GUILD OF MAPLELEGENDS</span>
        <h1 class="hero-title">
          TOMATO<span class="seed">.</span>
        </h1>
        <p class="hero-sub">
          Your friendly Tomato guild. We play MapleLegends, a free private server for old school MapleStory. It's all about the fun and the people we meet along the way :D
        </p>
        <div class="hero-actions">
          <NuxtLink to="/roster" class="btn btn-cream">View the Roster</NuxtLink>
          <a class="btn btn-outline-light" href="https://legends.ml" target="_blank" rel="noopener">
            Play MapleLegends
          </a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container-wide">
        <div v-if="pending" class="skeleton stats" />
        <div v-else class="stats-grid">
          <div class="card stat-card">
            <div class="stat-value">{{ stats?.count ?? '&ndash;' }}</div>
            <div class="stat-label">Tomatoes</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value">{{ stats?.maxLevel ?? '&ndash;' }}</div>
            <div class="stat-label">Highest Level</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value">{{ stats?.avgLevel ?? '&ndash;' }}</div>
            <div class="stat-label">Average Level</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value">{{ lastSyncShort }}</div>
            <div class="stat-label">Roster Updated</div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="jrMasters.length" class="section" style="padding-top: 0">
      <div class="container-wide">
        <div class="card jr-card">
          <div class="jr-text">
            <h2 class="section-title" style="margin: 0">Meet your Jr Masters</h2>
            <p>
              Questions, raid help, or signup issues? These are the people to ask.
            </p>
            <NuxtLink to="/roster?rank=Jr. Master" class="btn btn-red">
              See all of the Jr Masters
            </NuxtLink>
          </div>
          <div class="jr-list">
            <NuxtLink
              v-for="m in jrMasters"
              :key="m.char_name"
              :to="`/members/${encodeURIComponent(m.char_name)}`"
              class="jr-item"
            >
              <span class="avatar-thumb">
                <img :src="m.avatar_url ?? undefined" :alt="m.char_name" loading="lazy" />
              </span>
              <span>
                <strong>{{ m.char_name }}</strong>
                <small>{{ m.guild_rank }} · Lv {{ m.level }} {{ m.job }}</small>
              </span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section v-if="topMembers.length" class="section" style="padding-top: 0">
      <div class="container-wide">
        <h2 class="section-title">Top of the Vine</h2>
        <div class="top-members">
          <NuxtLink
            v-for="(m, i) in topMembers"
            :key="m.char_name"
            :to="`/members/${encodeURIComponent(m.char_name)}`"
            class="card top-member"
          >
            <span class="crown">RANK #{{ i + 1 }}</span>
            <div class="avatar-wrap">
              <img
                :src="m.avatar_url ?? undefined"
                :alt="m.char_name"
                class="avatar"
                loading="lazy"
              />
            </div>
            <div class="t-name">{{ m.char_name }}</div>
            <div class="t-meta">
              <span class="t-level">Lv {{ m.level }}</span> &middot; {{ m.job }}
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="section" style="padding-top: 0">
      <div class="container-wide">
        <h2 class="section-title">What is Tomato?</h2>
        <div class="about-grid">
          <div class="about-art">
            <img
              v-if="master?.avatar_url"
              :src="master.avatar_url"
              :alt="`${master.char_name} — Guild Master`"
              class="master-portrait"
              loading="lazy"
            />
            <img v-else class="tomato-big" src="/tomato.svg" alt="A ripe tomato" />
          </div>
          <div class="about-text">
            <p>
              Tomato is a guild on the MapleLegends private server. We are close knit and strive to provide help to one another in a friendly and welcoming environment. We are not a hardcore guild, but we do enjoy running bosses and party quests together.
            </p>
            <p>
              The guild was founded by <NuxtLink :to="`/members/${encodeURIComponent(master?.char_name ?? '')}`" class="founder-link">{{ master?.char_name ?? 'tomatofren' }}</NuxtLink>, our guild master, during the early years of this server &mdash; grown one level at a time ever since.
            </p>
            <ul>
              <li>Daily boss runs &amp; party quests for everyone</li>
              <li>Helpful veterans happy to share tips</li>
              <li>Zero (hopefully) drama, zero requirements &mdash; just be a decent person</li>
            </ul>
            <p>
              <NuxtLink to="/roster" class="btn btn-red" style="margin-top: 14px">
                Meet the Members
              </NuxtLink>
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGuildMembers, useGuildStats, formatDate } from '~/composables/useGuildData'

const { members, refresh: refreshMembers } = useGuildMembers()
const { stats, pending, refresh: refreshStats } = useGuildStats()
useMemberRealtime(async () => {
  await Promise.all([refreshMembers(), refreshStats()])
})

const lastSyncShort = computed(() => {
  const iso = stats.value?.lastSync ?? members.value?.updatedAt ?? null
  return iso ? formatDate(iso) : '&ndash;'
})

const topMembers = computed(() => {
  const roster = members.value?.members ?? []
  return [...roster]
    .sort((a, b) => b.level - a.level || b.fame - a.fame)
    .slice(0, 3)
})

const jrMasters = computed(() => {
  const roster = members.value?.members ?? []
  return roster
    .filter((m) => m.guild_rank === 'Jr. Master' || m.guild_rank === 'Master')
    .sort((a, b) => b.level - a.level)
    .slice(0, 4)
})

const master = computed(() =>
  (members.value?.members ?? []).find((m) => m.guild_rank === 'Master' && m.char_name.toLowerCase() === 'tomatofren')
)
</script>
