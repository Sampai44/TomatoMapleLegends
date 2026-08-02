import { TextChannel } from 'discord.js'
import { getSupabaseAdmin } from './db.js'

/**
 * Listens for roster updates and announces changes (currently: level-ups) in
 * a designated channel. This is the Discord-native feature that has no direct
 * website equivalent — it turns the 6-hourly sync into fun announcements.
 *
 * The bot uses Supabase **realtime (postgres changes)** on `guild_members`.
 * This requires `alter publication supabase_realtime add table public.guild_members;`
 * which the website schema already includes — nothing extra to set up.
 */
export function startLevelUpWatcher(client) {
  const channelId = process.env.ANNOUNCEMENTS_CHANNEL_ID
  const allowedJobs = (process.env.ANNOUNCE_JOBS ?? '')
    .split(',')
    .map((j) => j.trim().toLowerCase())
    .filter(Boolean)

  if (!channelId) {
    console.log('[realtime] ANNOUNCEMENTS_CHANNEL_ID not set — skipping level-up watcher')
    return
  }

  const supabase = getSupabaseAdmin()

  supabase
    .channel('member-changes')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'guild_members' },
      async (payload) => {
        const oldLevel = payload.old?.level
        const newLevel = payload.new?.level
        if (typeof oldLevel !== 'number' || typeof newLevel !== 'number') return
        if (newLevel <= oldLevel) return

        const announceJob = allowedJobs.includes(payload.new.job?.toLowerCase?.() ?? '')
        if (allowedJobs.length && !announceJob) return

        const channel = await (async () => {
          try { return await client.channels.fetch(channelId) } catch { return null }
        })()
        if (!channel || !(channel instanceof TextChannel)) return

        await channel.send({
          content: `🎉 **${payload.new.char_name}** (${payload.new.job}) hit **level ${newLevel}**! 🍅`
        })
      })
    .subscribe()
}