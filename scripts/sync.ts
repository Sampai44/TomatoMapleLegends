/**
 * Standalone guild sync runner.
 *
 * Usage:
 *   node --env-file-if-exists=.env scripts/sync.ts            # scrape + push to Supabase
 *   node --env-file-if-exists=.env scripts/sync.ts --dry-run  # scrape + print, no DB writes
 */
import { scrapeGuildMembers, syncGuildMembers } from '../server/services/legends.ts'
import { getSupabaseAdmin } from '../server/utils/supabase.ts'

const dryRun = process.argv.includes('--dry-run')

console.log('Scraping Tomato roster from legends.ml ...')
const members = await scrapeGuildMembers()

console.log(`Scraped ${members.length} member(s)`)
for (const m of members) {
  console.log(`  #${m.ranking} ${m.charName} (${m.job}, Lv ${m.level}, ${m.guildRank})${m.isDonor ? ' [donor]' : ''}`)
}

if (dryRun) {
  console.log('\nDry run — nothing written to the database.')
  process.exit(0)
}

const result = await syncGuildMembers(getSupabaseAdmin(), members)
console.log('\nSync complete:')
console.log(JSON.stringify(result, null, 2))
