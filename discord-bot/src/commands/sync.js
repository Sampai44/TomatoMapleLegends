import { scrapeGuildMembers } from '../scraper.js'
import { syncGuildMembers } from './_sync.js'
import { getSupabaseAdmin } from '../db.js'
import { EmbedBuilder } from 'discord.js'
import { errorEmbed } from '../utils.js'

export const name = 'sync'

export const definition = {
  name: 'sync',
  description: 'Re-scrape the roster from legends.ml and push it to the database.',
  options: [
    { name: 'dry', description: 'Only scrape and preview, don\'t write to the DB', type: 5, required: false }
  ]
}

export async function run(interaction) {
  const dry = interaction.options.getBoolean('dry') ?? false
  const client = getSupabaseAdmin()
  try {
    const members = await scrapeGuildMembers()
    if (dry) {
      const lines = members.slice(0, 20).map((m) => `#${m.ranking} **${m.charName}** — Lv ${m.level} ${m.job}${m.isDonor ? ' 💎' : ''}`)
      return {
        embeds: [new EmbedBuilder().setColor(0x58b9ff).setTitle(`Scraped ${members.length} members (dry run)`).setDescription(lines.join('\n') || 'No members')]
      }
    }
    const result = await syncGuildMembers(client, members)
    return {
      embeds: [new EmbedBuilder().setColor(0x27ae60).setTitle('Roster sync complete')
        .setDescription(`Scraped **${result.scraped}** · archived **${result.archived}** · unchanged **${result.unchanged}**`)]
    }
  } catch (e) {
    return errorEmbed(e.message)
  }
}