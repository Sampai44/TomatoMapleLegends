// Boss catalog for Tomato raid scheduling. Each boss ships a gallery image
// (served from legends.ml's monster library) plus a few "relevant details"
// shown right in the picker. Shared between the admin form and the public
// raid list (`#shared/bosses`).

const image = (id: number) => `https://legends.ml/static/images/lib/monster/${id}.png`

export interface BossInfo {
  name: string
  /** Lowercase aliases used to match a stored `boss` string back to a catalog entry. */
  aliases: string[]
  image: string
  /** Suggested minimum level; the form pre-fills `min_level` with this. */
  recommendedLevel: number
  /** Short level/HP line shown under the name. */
  levelLabel: string
  blurb: string
}

export const BOSSES: BossInfo[] = [
  {
    name: 'Horntail',
    aliases: ['horntail', 'horizon'],
    image: image(8810018),
    recommendedLevel: 150,
    levelLabel: 'Lv ~150 · 2.09B HP',
    blurb: 'Nine-headed elder dragon guarding the Cave of Life — a rewarding guild classic.'
  },
  {
    name: 'Zakum',
    aliases: ['zakum'],
    image: image(8800000),
    recommendedLevel: 140,
    levelLabel: 'Lv 140 · 66M HP',
    blurb: 'The ritual statue of the black flame. Two entries a day; drops the iconic Zakum Helms.'
  },
  {
    name: 'Scarlion & Targa',
    aliases: ['scarlion', 'targa', 'scar', 'scarlion & targa'],
    image: image(9420547),
    recommendedLevel: 90,
    levelLabel: 'Lv 80 · 60M HP each',
    blurb: 'The twin lions — a fun, fast duo boss that pairs well with lower-level raids.'
  },
  {
    name: 'Ergoth (GPQ)',
    aliases: ['ergoth', 'gpq', 'guild party quest', 'guild pq'],
    image: image(9300028),
    recommendedLevel: 120,
    levelLabel: 'Lv 115 · Guild PQ',
    blurb: 'The boss of the Guild Party Quest — earn guild points while you fight.'
  }
]

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Map an arbitrary stored boss string back to a catalog entry, if known.
 * Returns null for bosses outside the catalog (they render without art).
 */
export function bossOf(raw: string): BossInfo | null {
  if (!raw) return null
  const n = norm(raw)
  return BOSSES.find((b) => b.aliases.some((a) => a === n || (a.length > 3 && n.includes(a)))) ?? null
}