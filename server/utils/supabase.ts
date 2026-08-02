import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Admin (service-role) Supabase client. Reads env vars directly so the same
 * util works from both Nitro server routes and the standalone sync script.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(url, key, {
    auth: { persistSession: false }
  })
}
