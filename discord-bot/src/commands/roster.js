import { EmbedBuilder } from 'discord.js'
import { getSupabaseAdmin } from '../db.js'
import { BRANCH_KEYS } from '../jobs.js'
import { errorEmbed } from '../utils.js'

export const name = 'roster'

export const definition = {
  name: 'roster',
  description: 'List guild members, optionally filtered by class and sorted by level/fame.',
  options: [
    { name: 'branch', description: 'Filter by class branch', type: 3, required: false, choices: BRANCH_KEYS.map((k) => ({ name: k, value: k })) },
    { name: 'sort', description: 'Sort field', type: 3, required: false, choices: [
      { name: 'guild rank', value: 'guild_rank' },
      { name: 'level', value: 'level' },
      { name: 'fame', value: 'fame' }
    ] },
    { name: 'jobs', description: 'Only list the given job (e.g. Bishop)', type: 3, required: false }
  ]
}

export async function run(interaction) {
  const branch = interaction.options.getString('branch') ?? ''
  const sort = interaction.options.getString('sort') ?? 'guild_rank'
  const job = interaction.options.getString('jobs')?.trim() ?? ''
  const client = getSupabaseAdmin()

  let q = client.from('guild_members').select('*')
  if (branch) q = q.eq('job_branch', branch)
  if (job) q = q.ilike('job', job)
  q = q.order(sort, { ascending: sort === 'level' ? false : true }).limit(15)

  const { data, error } = await q
  if (error) return errorEmbed(error.message)

  const lines = (data ?? []).map((m) => `**${m.char_name}** — Lv ${m.level} ${m.guild_rank} · ${m.job}${m.is_donor ? ' 💎' : ''}`)

  const embed = new EmbedBuilder()
    .setColor(0x58b9ff)
    .setTitle(`Tomato Roster${branch ? ` · ${branch}` : ''}`)
    .setDescription(lines.length ? lines.join('\n') : 'No members match that filter.')

  return { embeds: [embed] }
}