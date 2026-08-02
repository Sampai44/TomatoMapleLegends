import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let accessToken: string | null = null

/** Singleton supabase-js client (browser session in localStorage). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const config = useRuntimeConfig()
    client = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    })
    client.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token ?? null
    })
  }
  return client
}

export function getAccessToken(): string | null {
  return accessToken
}

/**
 * Attach `Authorization: Bearer <jwt>` to every request to our own /api
 * routes, so useFetch/$fetch and the realtime channel behave consistently.
 */
export default defineNuxtPlugin(() => {
  const supabase = getSupabase()
  supabase.auth.getSession().then(({ data }) => {
    accessToken = data.session?.access_token ?? null
  })

  const original = globalThis.fetch
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('/api/') && accessToken) {
      const headers = new Headers(init?.headers)
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${accessToken}`)
      init = { ...init, headers }
    }
    return original(input, init)
  }
})
