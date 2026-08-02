import { getSupabaseAdmin } from '../utils/supabase'

/**
 * Sign out. The session lives in the browser (supabase-js localStorage), so
 * server-side this only clears the cookie. The client calls this after
 * supabase.auth.signOut() to tidy up.
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) {
      const { data: user } = await getSupabaseAdmin().auth.getUser(token)
      if (user.user) {
        await getSupabaseAdmin().auth.admin.signOut(user.user.id).catch(() => null)
      }
    }
  }
  setCookie(event, 'sb-auth-token', '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax' })
  return { ok: true }
})
