import { EmbedBuilder } from 'discord.js'
import { getSupabaseAdmin } from '../db.js'
import { defaultParties, parseSlots, totalParticipantSeats, validateRaidPayload } from '../raidLogic.js'
import { bossColor, errorEmbed, formatDateTime, requireJrMaster } from '../utils.js'

export const name = 'raid'

export const definition = {
  name: 'raid',
  description: 'Schedule and manage boss raids. Create/cancel/review are for Jr. Masters.',
  options: [
    { name: 'list', description: 'List upcoming raids with capacity.', type: 1 },
    {
      name: 'create',
      description: '[Jr. Master] Schedule a new boss raid.',
      type: 1,
      options: [
        { name: 'boss', description: 'Boss name', type: 3, required: true },
        { name: 'when', description: 'Start time "YYYY-MM-DD HH:MM" (UTC), e.g. "2026-08-03 20:00"', type: 3, required: true },
        { name: 'duration', description: 'Minutes (15-600)', type: 4, required: false, min_value: 15, max_value: 600 },
        { name: 'minlevel', description: 'Minimum level to join', type: 4, required: false, min_value: 0, max_value: 300 },
        { name: 'leader', description: 'Raid leader IGN', type: 3, required: false },
        { name: 'notes', description: 'Info shown on the signup', type: 3, required: false },
        { name: 'guide', description: 'Guide URL', type: 3, required: false },
        { name: 'parties', description: 'Template: "Party 1:6:1x Bishop,5x Any" (repeat parts with | )', type: 3, required: false },
        { name: 'buyerprice', description: 'Price in mesos charged to buyers (0 = no buyers)', type: 4, required: false, min_value: 0 },
        { name: 'buyerlimit', description: 'Max buyers (0 = unlimited)', type: 4, required: false, min_value: 0, max_value: 50 }
      ]
    },
    {
      name: 'cancel',
      description: '[Jr. Master] Cancel a scheduled raid.',
      type: 1,
      options: [{ name: 'id', description: 'Raid id', type: 4, required: true }]
    },
    {
      name: 'review',
      description: '[Jr. Master] List pending signups to approve/decline.',
      type: 1,
      options: [{ name: 'id', description: 'Raid id', type: 4, required: true }]
    },
    {
      name: 'approve',
      description: '[Jr. Master] Approve a pending signup.',
      type: 1,
      options: [
        { name: 'id', description: 'Raid id', type: 4, required: true },
        { name: 'ign', description: "Signup's IGN to approve", type: 3, required: true },
        { name: 'party', description: 'Party name to assign', type: 3, required: true },
        { name: 'slot', description: 'Slot job (e.g. Any, Bishop)', type: 3, required: false }
      ]
    },
    {
      name: 'decline',
      description: '[Jr. Master] Decline a pending signup with a reason.',
      type: 1,
      options: [
        { name: 'id', description: 'Raid id', type: 4, required: true },
        { name: 'ign', description: 'Signup IGN to decline', type: 3, required: true },
        { name: 'reason', description: 'Why it was declined', type: 3, required: false }
      ]
    }
  ]
}

async function loadRaid(client, id) {
  const { data } = await client.from('boss_raids').select('*').eq('id', id).maybeSingle()
  return data ?? null
}

async function loadSignups(client, raidId) {
  const { data } = await client.from('raid_signups').select('*').eq('raid_id', raidId)
  return data ?? []
}

function raidEmbed(raid, signups) {
  const seats = totalParticipantSeats(raid)
  const line = `Leader: **${raid.leader || '—'}** · Min level ${raid.min_level} · ${raid.duration_minutes} min · ${seats} seats${raid.buyer_limit ? ` · ${raid.buyer_limit} buyers @ ${raid.buyer_price} meso` : ''}`
  const partyLines = (raid.slots ?? []).map((p) => {
    const jobs = p.jobs.length ? p.jobs.map((j) => `${j.count}× ${j.job}`).join(', ') : 'open'
    return `**${p.party}** (${p.size}): ${jobs}`
  })
  const embed = new EmbedBuilder()
    .setColor(bossColor(raid.boss))
    .setTitle(`🍅 ${raid.boss} · ${formatDateTime(raid.scheduled_at)}`)
    .setDescription(raid.notes || null)
    .addFields(
      { name: 'Details', value: line, inline: false },
      { name: 'Parties', value: partyLines(raid), inline: false },
      { name: 'Guide', value: raid.guide_url ? raid.guide_url : '—', inline: false }
    )
  return embed
}

function partyLines(raid) {
  return (raid.slots ?? []).map((p) => {
    const jobs = p.jobs.length ? p.jobs.map((j) => `${j.count}× ${j.job}`).join(', ') : 'open'
    return `**${p.party}** (${p.size}): ${jobs}`
  }).join('\n') || '—'
}

async function list(interaction) {
  const client = getSupabaseAdmin()
  const now = Date.now()
  const { data: raids, error } = await client.from('boss_raids').select('*').order('scheduled_at', { ascending: false })
  if (error) return errorEmbed(error.message)

  const upcoming = (raids ?? []).filter((r) => r.status === 'scheduled' && new Date(r.scheduled_at).getTime() + r.duration_minutes * 60000 > now)
  const lines = upcoming.length
    ? upcoming.map((r) => `**${r.id}** — ${r.boss} · ${formatDateTime(r.scheduled_at)}`)
    : ['No upcoming raids. Use `/raid create` to schedule one.']

  return { embeds: [new EmbedBuilder().setColor(0x58b9ff).setTitle('🍅 Upcoming Raids').setDescription(lines.join('\n'))] }
}

async function create(interaction) {
  if (!requireJrMaster(interaction)) return null
  const client = getSupabaseAdmin()
  const when = interaction.options.getString('when')
  const scheduled = new Date(`${when.replace(' ', 'T')}:00Z`)
  const parsed = parseSlots(interaction.options.getString('parties'))

  const body = {
    boss: interaction.options.getString('boss'),
    scheduledAt: scheduled.toISOString(),
    durationMinutes: interaction.options.getInteger('duration') ?? 120,
    minLevel: interaction.options.getInteger('minlevel') ?? 1,
    leader: interaction.options.getString('leader') ?? '',
    notes: interaction.options.getString('notes') ?? '',
    guideUrl: interaction.options.getString('guide') ?? '',
    slots: parsed.error ? defaultParties(1) : parsed.slots,
    buyersEnabled: (interaction.options.getInteger('buyerprice') ?? 0) > 0,
    buyerPrice: interaction.options.getInteger('buyerprice') ?? 0,
    buyerLimit: interaction.options.getInteger('buyerlimit') ?? 0
  }

  let payload
  try {
    payload = validateRaidPayload(body)
  } catch (e) {
    return { content: e.message, ephemeral: true }
  }

  const { data, error } = await client.from('boss_raids').insert(payload).select('*').single()
  if (error) return errorEmbed(error.message)

  return {
    content: `Scheduled **${data.boss}** for ${formatDateTime(data.scheduled_at)}.`,
    embeds: [raidEmbed(data, [])]
  }
}

async function cancel(interaction) {
  if (!requireJrMaster(interaction)) return null
  const client = getSupabaseAdmin()
  const id = interaction.options.getInteger('id')
  const { data, error } = await client.from('boss_raids').update({ status: 'cancelled' }).eq('id', id).select('*').single()
  if (error) return errorEmbed(error.message)
  return { content: `Cancelled **${data.boss}** (raid #${id}).` }
}

async function review(interaction) {
  if (!requireJrMaster(interaction)) return null
  const client = getSupabaseAdmin()
  const id = interaction.options.getInteger('id')
  const raid = await loadRaid(client, id)
  if (!raid) return { content: `Raid #${id} not found.`, ephemeral: true }

  const pending = (await loadSignups(client, id)).filter((s) => s.status === 'pending')
  const lines = pending.length
    ? pending.map((s) => `**${s.ign}** (${s.job}, Lv ${s.level}) — ${s.kind}`)
    : ['No pending signups.']
  return {
    embeds: [new EmbedBuilder().setColor(bossColor(raid.boss)).setTitle(`${raid.boss} signups to review`).setDescription(lines.join('\n'))]
  }
}

async function approve(interaction) {
  if (!requireJrMaster(interaction)) return null
  const client = getSupabaseAdmin()
  const id = interaction.options.getInteger('id')
  const ign = interaction.options.getString('ign').trim()
  const party = interaction.options.getString('party')
  const slot = interaction.options.getString('slot') ?? 'Any'

  const { data, error } = await client
    .from('raid_signups')
    .update({ status: 'approved', party, slot_job: slot, decided_at: new Date().toISOString() })
    .eq('raid_id', id)
    .ilike('ign', ign)
    .eq('status', 'pending')
    .select('*')
    .single()
  if (error) return errorEmbed(error.message)
  return { content: `Approved **${data.ign}** for raid #${id} → ${party} (${slot}).` }
}

async function decline(interaction) {
  if (!requireJrMaster(interaction)) return null
  const client = getSupabaseAdmin()
  const id = interaction.options.getInteger('id')
  const ign = interaction.options.getString('ign').trim()
  const reason = interaction.options.getString('reason') ?? ''

  const { data, error } = await client
    .from('raid_signups')
    .update({ status: 'declined', reason, decided_at: new Date().toISOString() })
    .eq('raid_id', id)
    .ilike('ign', ign)
    .eq('status', 'pending')
    .select('*')
    .single()
  if (error) return errorEmbed(error.message)
  return { content: `Declined **${data.ign}** for raid #${id}${reason ? ` (${reason})` : ''}.` }
}

export async function run(interaction) {
  const sub = interaction.options.getSubcommand()
  const dispatch = { list, create, cancel, review, approve, decline }
  const fn = dispatch[sub]
  if (!fn) return { content: `Unknown subcommand ${sub}`, ephemeral: true }
  return fn(interaction)
}