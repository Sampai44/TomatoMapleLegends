import * as cheerio from 'cheerio'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface GuildMemberRow {
  charName: string
  guildRank: string
  job: string
  jobBranch: string
  level: number
  exp: number
  fame: number
  ranking: number
  isDonor: boolean
  avatarUrl: string | null
  legendsUrl: string
}

export interface SyncResult {
  scraped: number
  upserted: number
  archived: number
  unchanged: number
  syncedAt: string
}

const RANKING_URL = 'https://legends.ml/ranking/guildmembers'
export const GUILD_SEARCH = 'Tomato'
/** legends.ml silently caps rows at 100 per page even when asked for more. */
export const MAX_PER_PAGE = 100
const MAX_PAGES = 10

/**
 * Fetch one page of the MapleLegends guild-member ranking table.
 * The site's own UI caps "max" at 50, but the query string accepts up to 100
 * rows per page — we request 100 and paginate until a page comes back short.
 */
export async function fetchGuildPage(page: number, search = GUILD_SEARCH): Promise<string> {
  const url = new URL(RANKING_URL)
  url.searchParams.set('page', String(page))
  url.searchParams.set('max', String(MAX_PER_PAGE))
  url.searchParams.set('search', search)

  const res = await fetch(url, {
    headers: {
      'user-agent': 'tomato-guild-scraper/1.0 (guild website; github.com/tomato)'
    }
  })
  if (!res.ok) {
    throw new Error(`legends.ml responded with ${res.status} ${res.statusText}`)
  }
  return res.text()
}

/**
 * Parse the ranking table out of a legends.ml guildmembers page.
 *
 * Table layout (per row):
 *   [0] rank (#<b>1</b>)
 *   [1] character avatar <img src="maplestory.io/api/character/...">
 *   [2] <a class="character_name [donor_name]">Name</a> + guild name link
 *   [3] <a class="class_link">branch img + <br/> Job name</a>
 *   [4] fame
 *   [5] level + <span class="text-muted">exp%</span> (exp span is absent at max level)
 *   [6] guild rank
 */
export function parseGuildMembers(html: string, expectedGuild = GUILD_SEARCH): GuildMemberRow[] {
  const $ = cheerio.load(html)
  const members: GuildMemberRow[] = []

  $('#rankingTable table tr').each((_i, el) => {
    const row = $(el)
    const cells = row.find('td')
    if (cells.length < 6) return

    const rankText = cells.eq(0).text().replace(/[#\s]/g, '')
    const ranking = Number.parseInt(rankText, 10) || 0

    const nameEl = cells.eq(2).find('a.character_name')
    const charName = nameEl.text().trim()
    if (!charName) return

    const guildName = cells.eq(2).find('a.guild_name_link').text().trim()
    if (guildName.toLowerCase() !== expectedGuild.toLowerCase()) return

    const jobLink = cells.eq(3).find('a.class_link')
    const job = jobLink.text().trim().replace(/\s+/g, ' ')
    const branchSrc = jobLink.find('img').attr('src') ?? ''
    const jobBranch = branchSrc.split('/').pop()?.replace(/\.png$/i, '') ?? ''

    const fame = Number.parseInt(cells.eq(4).find('b').first().text().replace(/[^\d]/g, ''), 10) || 0
    const level = Number.parseInt(cells.eq(5).find('b').first().text().replace(/[^\d]/g, ''), 10) || 0
    const expText = cells.eq(5).find('span.text-muted').first().text().trim()
    const exp = expText ? Number.parseFloat(expText.replace(/[^\d.]/g, '')) || 0 : 0

    const guildRank = cells.eq(6).find('b').first().text().trim() || 'Member'
    const avatarUrl = cells.eq(1).find('img').first().attr('src') ?? null
    const legendsUrl = nameEl.attr('href') ?? `/levels?name=${encodeURIComponent(charName)}`

    members.push({
      charName,
      guildRank,
      job: job || 'Beginner',
      jobBranch: jobBranch || 'beginner',
      level,
      exp,
      fame,
      ranking,
      isDonor: nameEl.hasClass('donor_name'),
      avatarUrl,
      legendsUrl
    })
  })

  return members
}

/**
 * Crawl the ranking pages until we have the full guild, or we hit MAX_PAGES.
 * Stops early when a page returns fewer rows than the per-page cap (end of list).
 */
export async function scrapeGuildMembers(search = GUILD_SEARCH): Promise<GuildMemberRow[]> {
  const all: GuildMemberRow[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchGuildPage(page, search)
    const rows = parseGuildMembers(html, search)
    if (rows.length === 0) break
    all.push(...rows)
    if (rows.length < MAX_PER_PAGE) break
  }
  return all
}

/**
 * Archive changed rows into member_snapshots, then upsert the current roster
 * into guild_members. Keeps characters that stop appearing (e.g. alts) in the
 * table with a stale `last_seen` rather than deleting them.
 */
export async function syncGuildMembers(client: SupabaseClient, members: GuildMemberRow[]): Promise<SyncResult> {
  const now = new Date().toISOString()

  const { data: existing, error: fetchError } = await client
    .from('guild_members')
    .select('char_name, level, fame, exp, guild_rank, job')

  if (fetchError) throw new Error(`failed to load existing roster: ${fetchError.message}`)

  const byName = new Map((existing ?? []).map((row) => [row.char_name, row]))
  const snapshots: Array<Record<string, unknown>> = []
  let unchanged = 0

  for (const m of members) {
    const prev = byName.get(m.charName)
    const changed =
      !prev ||
      prev.level !== m.level ||
      prev.fame !== m.fame ||
      prev.exp !== m.exp ||
      prev.guild_rank !== m.guildRank ||
      prev.job !== m.job

    if (changed) {
      snapshots.push({
        char_name: m.charName,
        level: m.level,
        fame: m.fame,
        exp: m.exp,
        guild_rank: m.guildRank,
        job: m.job
      })
    } else {
      unchanged++
    }
  }

  let archived = 0
  if (snapshots.length > 0) {
    const { error: snapError } = await client.from('member_snapshots').insert(snapshots)
    if (snapError) throw new Error(`failed to archive snapshots: ${snapError.message}`)
    archived = snapshots.length
  }

  const { error: upsertError } = await client
    .from('guild_members')
    .upsert(
      members.map((m) => ({
        char_name: m.charName,
        guild_rank: m.guildRank,
        job: m.job,
        job_branch: m.jobBranch,
        level: m.level,
        exp: m.exp,
        fame: m.fame,
        ranking: m.ranking,
        is_donor: m.isDonor,
        avatar_url: m.avatarUrl,
        legends_url: m.legendsUrl,
        last_seen: now,
        updated_at: now
      })),
      { onConflict: 'char_name' }
    )

  if (upsertError) throw new Error(`failed to upsert roster: ${upsertError.message}`)

  return {
    scraped: members.length,
    upserted: members.length,
    archived,
    unchanged,
    syncedAt: now
  }
}
