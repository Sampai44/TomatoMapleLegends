import { EmbedBuilder } from 'discord.js'

export function isJrMaster(interaction) {
  const roleId = process.env.JUNIOR_MASTER_ROLE_ID
  if (!roleId) return false
  return interaction.member.roles.cache.has(roleId)
}

export function requireJrMaster(interaction) {
  if (!isJrMaster(interaction)) {
    interaction.reply({ content: 'This command is for guild Jr. Masters only.', ephemeral: true })
    return false
  }
  return true
}

export function rankEmoji(rank = 'Member') {
  const r = rank.toLowerCase()
  if (r.includes('master')) return '👑'
  if (r === 'jr. master' || r.includes('jr')) return '🎖️'
  return '⭐'
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function errorEmbed(message) {
  return {
    embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Something went wrong').setDescription(String(message))]
  }
}

export function bossColor(boss = '') {
  const lower = boss.toLowerCase()
  if (lower.includes('horntail')) return 0x8e44ad
  if (lower.includes('zakum')) return 0xe67e22
  if (lower.includes('pink bean')) return 0xff6eb4
  if (lower.includes('von leon')) return 0x34495e
  if (lower.includes('papulatus')) return 0x16a085
  return 0x2ecc71
}