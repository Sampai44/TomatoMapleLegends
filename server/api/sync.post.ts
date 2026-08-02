import { getSupabaseAdmin } from '../utils/supabase'
import { scrapeGuildMembers, syncGuildMembers } from '../services/legends'

/**
 * Protected endpoint that scrapes legends.ml and writes the roster to Supabase.
 * Invoked by the Vercel cron (vercel.json). Protect with the SYNC_SECRET env
 * var — send it as `x-sync-secret: <value>` or `Authorization: Bearer <value>`.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.SYNC_SECRET
  const header =
    getHeader(event, 'x-sync-secret') ??
    getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')

  if (!secret || !header || header !== secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  try {
    const members = await scrapeGuildMembers()
    const result = await syncGuildMembers(getSupabaseAdmin(), members)
    return { ok: true, ...result }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Sync failed',
      message: error.message
    })
  }
})
