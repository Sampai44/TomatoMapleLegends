import dotenv from 'dotenv'
import { REST, Routes } from 'discord.js'
import * as commands from './commands/index.js'

dotenv.config()

const token = process.env.DISCORD_TOKEN
const clientId = process.env.DISCORD_CLIENT_ID
const guildId = process.env.DISCORD_GUILD_ID

if (!token || !clientId) {
  console.error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID. Copy .env.example to .env.')
  process.exit(1)
}

const definitions = Object.values(commands)
  .map((c) => c.definition)
  .filter(Boolean)

const rest = new REST({ version: '10' }).setToken(token)

try {
  console.log(`Registering ${definitions.length} slash command(s)…`)
  if (guildId) {
    await rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, { body: definitions })
    console.log(`Registered to guild ${guildId}.`)
  } else {
    await rest.put(`/applications/${clientId}/commands`, { body: definitions })
    console.log('Registered globally (can take up to an hour to show).')
  }
} catch (error) {
  console.error('Failed to register commands:', error)
  process.exit(1)
}