import { getSupabaseAdmin } from '../db.js'
import { jobQualifies, branchLabelOf } from '../jobs.js'
import { blockedSlotsSummary, openSlotsFor, totalParticipantSeats } from '../raidLogic.js'
import { errorEmbed } from '../utils.js'

export const name = 'signup'

export const definition = {
  name: 'signup',
  description: 'Sign up for a scheduled raid with your in-game name.',
  options: [
    { name: 'id', description: 'Raid id (see /raid list)', type: 4, required: true },
    { name: 'ign', description: 'Your in-game character name', type: 3, required: true },
    { name: 'job', description: 'Your job (from the roster, if you don\'t want it auto-looked up)', type: 3, required: false },
    { name: 'buyer', description: 'Sign up as a buyer instead of a participant', type: 5, required: false }
  ]
}

export async function run(interaction) {
  const client = getSupabaseAdmin()
  const id = interaction.options.getInteger('id')
  const ign = interaction.options.getString('ign').trim()
  const asBuyer = interaction.options.getBoolean('buyer') ?? false
  const explicitJob = interaction.options.getString('job')?.trim() ?? ''

  const { data: raid, error: rErr } = await client.from('boss_raids').select('*').eq('id', id).maybeSingle()
  if (rErr) return errorEmbed(rErr.message)
  if (!raid) return { content: `Raid #${id} not found. Use /raid list to see ids.`, ephemeral: true }
  if (raid.status !== 'scheduled') return { content: `Raid #${id} is cancelled.`, ephemeral: true }

  const { data: roster } = await client.from('guild_members').select('*').ilike('char_name', ign).maybeSingle()
  const job = explicitJob || roster?.job || ''
  const level = roster?.level ?? 0
  const guildRank = roster?.guild_rank ?? 'Member'

  if (asBuyer) {
    if (!raid.buyers_enabled) return { content: 'This raid does not accept buyers.', ephemeral: true }
    const { error: bErr } = await client
      .from('raid_signups')
      .insert({ raid_id: id, ign, kind: 'buyer', job, level, party: '', slot_job: 'Buyer', status: 'pending' })
    if (bErr) {
      if (bErr.code === '23505') return { content: `Already signed up **${ign}**. (Use a different IGN or wait for a Jr. Master to act.)`, ephemeral: true }
      return errorEmbed(bErr.message)
    }
    return { content: `Signed **${ign}** up as a buyer for ${raid.boss} (pending approval).` }
  }

  if (level < raid.min_level) {
    return { content: `**${ign}** is Lv ${level} but raid #${id} requires Lv ${raid.min_level}+.`, ephemeral: true }
  }

  const { data: all, error: sErr } = await client.from('raid_signups').select('*').eq('raid_id', id)
  if (sErr) return errorEmbed(sErr.message)
  const signups = all ?? []

  if (totalParticipantSeats(raid) > 0) {
    if (!job) {
      return { content: `You don't have a job on the roster — please pass your job via the \`job\` option.`, ephemeral: true }
    }
    const open = openSlotsFor(raid, signups, job)
    if (open.length === 0) {
      const blocked = blockedSlotsSummary(raid, signups, job)
      return { content: `Sorry, no open ${branchLabelOf(job)} seat this raid anymore.${blocked ? ` Still needed: ${blocked}.` : ''}`, ephemeral: true }
    }
  }

  const { error: iErr } = await client
    .from('raid_signups')
    .insert({ raid_id: id, ign, kind: 'participant', job, level, party: '', slot_job: '', status: 'pending' })
  if (iErr) {
    if (iErr.code === '23505') return { content: `You're already signed up as **${ign}** for raid #${id}.`, ephemeral: true }
    return errorEmbed(iErr.message)
  }

  return { content: `**${ign}** (${job || 'job TBD'}, Lv ${level}, ${guildRank}) is signed up for raid #${id} — pending a Jr. Master's approval.` }
}