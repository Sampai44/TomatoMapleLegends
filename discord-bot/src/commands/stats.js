import { EmbedBuilder } from 'discord.js'
import { getSupabaseAdmin } from '../db.js'
import { BRANCH_LABELS, BRANCH_KEYS } from '../jobs.js'
import { errorEmbed, formatDateTime } from '../utils.js'

export const name = 'stats'

export const definition = {
  name: 'stats',
  description: 'Guild-wide stats: member count, average/max level, job distribution.'
}

export async function run(interaction) {
  const client = getSupabaseAdmin()

  const { data: members, error } = await client.from('guild_members').select('level, job_branch, updated_at')
  if (error) return errorEmbed(error.message)

  const count = members?.length ?? 0
  const levels = members?.map((m) => m.level) ?? []
  const total = levels.reduce((a, b) => a + b, 0)
  const avg = count ? (total / count).toFixed(1) : '0'
  const max = levels.length ? Math.max(...levels) : 0

  const branchCounts = {}
  for (const m of members ?? []) {
    branchCounts[m.job_branch] = (branchCounts[m.job_branch] ?? 0) + 1
  }

  const lastSync = members && members.length
    ? members.reduce((acc, m) => (m.updated_at > (acc ?? '') ? m.updated_at : acc), null)
    : null

  const fields = [
    { name: 'Total members', value: String(count), inline: true },
    { name: 'Average level', value: avg, inline: true },
    { name: 'Max level', value: String(max), inline: true }
  ]

  const jobLines = BRANCH_KEYS.filter((k) => branchCounts[k]).map(
    (k) => `**${BRANCH_LABELS[k]}** — ${branchCounts[k]}`
  )
  if (jobLines.length) fields.push({ name: 'Classes', value: jobLines.join('\n') || '—', inline: false })

  const embed = new EmbedBuilder()
    .setColor(0x58b9ff)
    .setTitle('🍅 Tomato Guild Stats')
    .addFields(fields)
    .setFooter({ text: `Last synced: ${formatDateTime(lastSync)}` })

  return { embeds: [embed] }
}