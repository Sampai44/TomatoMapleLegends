import { getSupabaseAdmin } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const branch = typeof query.branch === 'string' ? query.branch.trim() : ''
  const sort = typeof query.sort === 'string' ? query.sort : 'guild_rank'
  const order = query.order === 'asc' ? 'asc' : 'desc'
  const limit = Math.min(Number.parseInt(String(query.limit ?? '500'), 10) || 500, 500)

  const sortColumn: Record<string, string> = {
    level: 'level',
    fame: 'fame',
    char_name: 'char_name',
    guild_rank: 'guild_rank'
  }
  const column = sortColumn[sort] ?? 'guild_rank'

  try {
    let q = getSupabaseAdmin().from('guild_members').select('*')

    if (search) q = q.ilike('char_name', `%${search}%`)
    if (branch) q = q.eq('job_branch', branch)
    q = q.order(column, { ascending: order === 'asc' }).limit(limit)

    const { data, error } = await q
    if (error) throw error

    return { members: data, updatedAt: data?.length ? data[0].updated_at : null }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load roster',
      message: error.message
    })
  }
})
