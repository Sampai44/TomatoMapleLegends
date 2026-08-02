import { EmbedBuilder } from 'discord.js'
import { getSupabaseAdmin } from '../db.js'
import { errorEmbed } from '../utils.js'

export const name = 'levels'

export const definition = {
  name: 'levels',
  description: "Show a member's level history tracked by the sync snapshots.",
  options: [
    { name: 'name', description: 'In-game character name', type: 3, required: true }
  ]
}

export async function run(interaction) {
  const query = interaction.options.getString('name').trim()
  const client = getSupabaseAdmin()

  const { data: member, error: mErr } = await client
    .from('guild_members')
    .select('char_name, job, level, fame, guild_rank')
    .ilike('char_name', query)
    .maybeSingle()
  if (mErr) return errorEmbed(mErr.message)
  if (!member) return { content: `Couldn't find **${query}** on the roster.`, ephemeral: true }

  const { data: history, error: hErr } = await client
    .from('member_snapshots')
    .select('level, fame, exp, snapshot_at')
    .eq('char_name', member.char_name)
    .order('snapshot_at', { ascending: false })
    .limit(12)
  if (hErr) return errorEmbed(hErr.message)

  const lines = (history ?? []).map(
    (h) => `**Lv ${h.level}** · ${h.fame} fame${h.exp ? ` · ${h.exp}%` : ''} — ${new Date(h.snapshot_at).toLocaleDateString()}`
  )

  const embed = new EmbedBuilder()
    .setColor(0x58b9ff)
    .setTitle(`${member.char_name} · Level history`)
    .setDescription(lines.length ? lines.join('\n') : 'No snapshots captured yet.')

  return { embeds: [embed] }
}