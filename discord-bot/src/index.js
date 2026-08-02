import dotenv from 'dotenv'
import { Client, GatewayIntentBits, ActivityType } from 'discord.js'
import { startLevelUpWatcher } from './realtime.js'
import * as commands from './commands/index.js'

dotenv.config()

const token = process.env.DISCORD_TOKEN
if (!token) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
})

client.commands = new Map(Object.values(commands).map((c) => [c.name, c]))

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`)
  client.user.setActivity('Tomato raids', { type: ActivityType.Watching })
  startLevelUpWatcher(client)
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const cmd = client.commands.get(interaction.commandName)
  if (!cmd) return

  try {
    const payload = await cmd.run(interaction)
    if (payload && payload.content !== undefined) {
      await interaction.deferReply().catch(() => {})
    }
    if (payload) {
      if (interaction.deferred) await interaction.editReply(payload)
      else await interaction.reply(payload)
    }
  } catch (error) {
    const message = error?.message ?? 'Unexpected error'
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `Error: ${message}` }).catch(() => {})
    } else {
      await interaction.reply({ content: `Error: ${message}`, ephemeral: true }).catch(() => {})
    }
  }
})

client.login(token)