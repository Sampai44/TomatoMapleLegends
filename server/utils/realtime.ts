import { getSupabaseAdmin } from './supabase'

/**
 * Broadcast a "raids changed" event on a shared realtime channel. Every raid
 * mutation (signup, approve, schedule, …) triggers this so open pages refresh
 * live. Best-effort: if realtime is slow, clients still refresh on demand.
 */
export async function publishRaidChange() {
  try {
    const client = getSupabaseAdmin()
    const channel = client.channel('raids-broadcast')
    await channel.send({ type: 'broadcast', event: 'raids-changed', payload: { at: Date.now() } })
    await client.removeChannel(channel)
  } catch {
    // realtime is a nicety — never fail a write because of it
  }
}
