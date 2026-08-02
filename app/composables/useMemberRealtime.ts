import { getSupabase } from '~/plugins/supabase'

/**
 * Live refresh for roster data: subscribes to guild_members changes (the daily
 * cron sync + any manual sync) and re-fetches member endpoints (debounced).
 */
export function useMemberRealtime(refresh: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => refresh(), 350)
  }

  onMounted(() => {
    const supabase = getSupabase()
    const channel = supabase
      .channel('members-broadcast')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guild_members' }, () => schedule())
      .subscribe()

    onUnmounted(() => {
      supabase.removeChannel(channel)
    })
  })
}
