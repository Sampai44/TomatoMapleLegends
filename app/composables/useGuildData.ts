import type { Ref } from 'vue'

export interface GuildMember {
  id: number
  char_name: string
  guild_rank: string
  job: string
  job_branch: string
  level: number
  exp: number
  fame: number
  ranking: number
  avatar_url: string | null
  legends_url: string
  first_seen: string
  last_seen: string
  updated_at: string
}

export interface GuildStats {
  count: number
  avgLevel: number
  maxLevel: number
  branchCounts: Record<string, number>
  lastSync: string | null
}

export interface MemberSnapshot {
  level: number
  fame: number
  exp: number
  guild_rank: string
  snapshot_at: string
}

export function useGuildMembers() {
  const { data, pending, error, refresh } = useFetch<{ members: GuildMember[]; updatedAt: string | null }>('/api/members')
  return { members: data, pending, error, refresh }
}

export function useGuildStats() {
  const { data, pending, refresh } = useFetch<GuildStats>('/api/members/stats')
  return { stats: data, pending, refresh }
}

export function useMemberDetail(name: string | string[]) {
  const { data, pending, error } = useFetch<{ member: GuildMember; history: MemberSnapshot[] }>(
    () => `/api/members/${encodeURIComponent(String(name))}`
  )
  return { data, pending, error }
}

export const BRANCH_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  warrior: 'Warrior',
  magician: 'Magician',
  bowman: 'Bowman',
  thief: 'Thief',
  pirate: 'Pirate'
}

export function sortMembers(members: Ref<GuildMember[] | null>, key: string, order: string) {
  if (!members.value) return []
  const dir = order === 'asc' ? 1 : -1
  return [...members.value].sort((a, b) => {
    const av = a[key as keyof GuildMember]
    const bv = b[key as keyof GuildMember]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
