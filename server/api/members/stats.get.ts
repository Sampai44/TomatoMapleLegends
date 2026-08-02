import { getSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async () => {
  try {
    const client = getSupabaseAdmin()

    const [{ data: members }, { count: total }] = await Promise.all([
      client.from('guild_members').select('*'),
      client.from('guild_members').select('*', { count: 'exact', head: true })
    ])

    const count = members?.length ?? total ?? 0
    const levels = members?.map((m) => m.level) ?? []
    const totalLevel = levels.reduce((a, b) => a + b, 0)
    const avgLevel = count ? Math.round((totalLevel / count) * 10) / 10 : 0
    const maxLevel = levels.length ? Math.max(...levels) : 0

    const branchCounts: Record<string, number> = {}
    for (const m of members ?? []) {
      branchCounts[m.job_branch] = (branchCounts[m.job_branch] ?? 0) + 1
    }

    const lastSync = members?.reduce<string | null>(
      (acc, m) => (m.updated_at > (acc ?? '') ? m.updated_at : acc),
      null
    )

    return {
      count,
      avgLevel,
      maxLevel,
      branchCounts,
      lastSync,
      scrapedAt: Date.now()
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to compute guild stats',
      message: error.message
    })
  }
})

