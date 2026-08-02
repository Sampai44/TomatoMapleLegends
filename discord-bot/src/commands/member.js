import { EmbedBuilder } from 'discord.js'
import { getSupabaseAdmin } from '../db.js'
import { branchLabelOf } from '../jobs.js'
import { errorEmbed } from '../utils.js'

export const name = 'member'

export const definition = {
  name: 'member',
  description: 'Look up a member on the Tomato roster by their in-game name.',
  options: [
    { name: 'name', description: 'In-game character name', type: 3, required: true }
  ]
}

export async function run(interaction) {
  const query = interaction.options.getString('name').trim()
  const client = getSupabaseAdmin()

  const { data: member, error } = await client
    .from('guild_members')
    .select('*')
    .ilike('char_name', query)
    .maybeSingle()

  if (error) return errorEmbed(error.message)
  if (!member) return { content: `Couldn't find **${query}** on the roster.`, ephemeral: true }

  const embed = new EmbedBuilder()
    .setColor(0x58b9ff)
    .setTitle(member.char_name)
    .setThumbnail(member.avatar_url ?? null)
    .addFields(
      { name: 'Job', value: `${branchLabelOf(member.job)} · ${member.job}`, inline: true },
      { name: 'Level', value: String(member.level), inline: true },
      { name: 'Fame', value: String(member.fame), inline: true },
      { name: 'Guild Rank', value: member.guild_rank, inline: true },
      { name: 'Donor', value: member.is_donor ? '💎 Yes' : '—', inline: true }
    )
    .setFooter({ text: member.legends_url ? `legend rank #${member.ranking}` : 'Tomato guild' })

  return { embeds: [embed] }
}