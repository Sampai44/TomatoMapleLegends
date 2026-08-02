import { getAuthContext } from '../utils/auth'

/**
 * Current session info. Only meaningful for jr masters / the master — the
 * only people who have accounts. Returns 200 with role='guest' when signed
 * out (the login page uses this to know whether to show a form).
 */
export default defineEventHandler(async (event) => {
  const ctx = await getAuthContext(event)
  return {
    authed: Boolean(ctx.user),
    uid: ctx.user?.id ?? null,
    email: ctx.user?.email ?? null,
    charName: ctx.member?.char_name ?? null,
    guildRank: ctx.member?.guild_rank ?? null,
    isAdmin: ctx.role === 'admin'
  }
})
