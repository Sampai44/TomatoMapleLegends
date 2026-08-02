import * as cheerio from 'cheerio'

/**
 * Roster scraper, ported from `server/services/legends.ts`. The bot can run
 * this manually via `/sync` to refresh the roster, but the Vercel cron on the
 * website already does this every 6 hours, so the bot doesn't have to.
 */
const RANKING_URL = 'https://legends.ml/ranking/guildmembers'
export const GUILD_SEARCH = 'Tomato'
const MAX_PER_PAGE = 100
const MAX_PAGES = 10

export async function fetchGuildPage(page, search = GUILD_SEARCH) {
  const url = new URL(RANKING_URL)
  url.searchParams.set('page', String(page))
  url.searchParams.set('max', String(MAX_PER_PAGE))
  url.searchParams.set('search', search)

  const res = await fetch(url, {
    headers: { 'user-agent': 'tomato-guild-scraper/1.0 (guild website; github.com/tomato)' }
  })
  if (!res.ok) throw new Error(`legends.ml responded with ${res.status} ${res.statusText}`)
  return res.text()
}

export function parseGuildMembers(html, expectedGuild = GUILD_SEARCH) {
  const $ = cheerio.load(html)
  const members = []

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

export async function scrapeGuildMembers(search = GUILD_SEARCH) {
  const all = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchGuildPage(page, search)
    const rows = parseGuildMembers(html, search)
    if (rows.length === 0) break
    all.push(...rows)
    if (rows.length < MAX_PER_PAGE) break
  }
  return all
}