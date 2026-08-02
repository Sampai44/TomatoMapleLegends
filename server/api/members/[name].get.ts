import { getSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const name = String(getRouterParam(event, 'name') ?? '').trim().toLowerCase()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing character name' })
  }

  try {
    const client = getSupabaseAdmin()

    const { data: member } = await client
      .from('guild_members')
      .select('*')
      .eq('char_name', name)
      .maybeSingle()

    if (!member) {
      throw createError({ statusCode: 404, statusMessage: 'Member not found' })
    }

    const { data: history } = await client
      .from('member_snapshots')
      .select('level, fame, exp, guild_rank, snapshot_at')
      .eq('char_name', name)
      .order('snapshot_at', { ascending: true })

    return { member, history: history ?? [] }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load member',
      message: error.message
    })
  }
})
