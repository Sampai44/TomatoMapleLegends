import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

/**
 * Admin (service-role) Supabase client. This is a verbatim copy of the
 * website's `server/utils/supabase.ts`. The bot uses the same database and
 * service key as the website, so both see identical data.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(url, key, {
    auth: { persistSession: false }
  })
}
