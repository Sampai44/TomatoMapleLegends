import { getSupabase } from '~/plugins/supabase'

/**
 * Live refresh: subscribes to the shared raids broadcast + postgres changes on
 * raids/signups and re-fetches /api/raids (debounced). Call with the raids
 * composable's `refresh`.
 */
export function useRaidRealtime(refresh: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => refresh(), 350)
  }

  onMounted(() => {
    const supabase = getSupabase()
    const channel = supabase
      .channel('raids-broadcast')
      .on('broadcast', { event: 'raids-changed' }, () => schedule())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boss_raids' }, () => schedule())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raid_signups' }, () => schedule())
      .subscribe()

    onUnmounted(() => {
      supabase.removeChannel(channel)
    })
  })
}
