import type { Ref } from 'vue'
import { getSupabase } from '~/plugins/supabase'

export interface Me {
  authed: boolean
  uid: string | null
  email: string | null
  charName: string | null
  guildRank: string | null
  isAdmin: boolean
}

/** Accounts exist only for jr masters and the master (username = IGN). */
export function useAuth() {
  const { data: me, refresh: refreshMe, pending: mePending } = useFetch<Me>('/api/me', {
    watch: false,
    server: false
  })

  const isAdmin = computed(() => me.value?.isAdmin === true)
  const charName = computed(() => me.value?.charName ?? null)

  async function signIn(ign: string, password: string) {
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithPassword({
      email: `${ign.trim()}@tomato.guild`,
      password
    })
    if (error) throw new Error(error.message)
    await refreshMe()
  }

  async function signOut() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    await refreshMe()
  }

  return { me, mePending, refreshMe, isAdmin, charName, signIn, signOut }
}
