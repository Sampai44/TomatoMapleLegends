import type { H3Event } from 'h3'
import { getSupabaseAdmin } from './supabase'

export interface SessionUser {
  id: string
  email?: string
}

export interface MemberRow {
  char_name: string
  guild_rank: string
  job: string
  job_branch: string
  level: number
  [key: string]: unknown
}

export type Role = 'guest' | 'admin'

export interface AuthContext {
  user: SessionUser | null
  member: MemberRow | null
  role: Role
}

/** Admin guild ranks, as scraped from legends.ml. */
export const ADMIN_RANKS = new Set(['Master', 'Jr. Master'])

/** Resolve the Supabase user from the Authorization: Bearer <jwt> header. */
export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const header = getHeader(event, 'authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  if (!token) return null

  const { data, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? undefined }
}

/**
 * Build the auth context. Accounts exist only for the guild Master and
 * Jr. Masters: username is the in-game name, so the roster row is found by
 * matching the account's email prefix against the character name.
 */
export async function getAuthContext(event: H3Event): Promise<AuthContext> {
  const user = await getSessionUser(event)
  if (!user) return { user: null, member: null, role: 'guest' }

  const charName = user.email?.split('@')[0]?.trim() ?? ''
  if (!charName) return { user, member: null, role: 'guest' }

  const { data: member } = await getSupabaseAdmin()
    .from('guild_members')
    .select('*')
    .ilike('char_name', charName)
    .maybeSingle<MemberRow>()

  const isAdmin = member ? ADMIN_RANKS.has(member.guild_rank) : false
  const ctx: AuthContext = { user, member, role: isAdmin ? 'admin' : 'guest' }
  event.context.auth = ctx
  return ctx
}

/** 401 unless signed in. Returns the auth context. */
export async function requireUser(event: H3Event): Promise<AuthContext> {
  const ctx = await getAuthContext(event)
  if (!ctx.user) throw createError({ statusCode: 401, statusMessage: 'Please log in first' })
  return ctx
}

/** 403 unless the user is a guild Master / Jr. Master in the live roster. */
export async function requireAdmin(event: H3Event): Promise<AuthContext> {
  const ctx = await requireUser(event)
  if (ctx.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only guild masters can do that' })
  }
  return ctx
}
