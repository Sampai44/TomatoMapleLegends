// MapleLegends v0.62 job list, shared between server (slot validation) and
// client (dropdowns). Branches match the roster's job_branch values.

export const BRANCH_KEYS = ['beginner', 'warrior', 'magician', 'bowman', 'thief', 'pirate'] as const

export type JobBranch = (typeof BRANCH_KEYS)[number]

export const BRANCH_LABELS: Record<JobBranch, string> = {
  beginner: 'Beginner',
  warrior: 'Warrior',
  magician: 'Magician',
  bowman: 'Bowman',
  thief: 'Thief',
  pirate: 'Pirate'
}

export const JOBS_BY_BRANCH: Record<JobBranch, string[]> = {
  beginner: ['Beginner'],
  warrior: [
    'Warrior',
    'Fighter',
    'Page',
    'Spearman',
    'Crusader',
    'White Knight',
    'Dragon Knight',
    'Hero',
    'Paladin',
    'Dark Knight'
  ],
  magician: [
    'Magician',
    'Cleric',
    'I/L Wizard',
    'F/P Wizard',
    'Priest',
    'I/L Mage',
    'F/P Mage',
    'Bishop',
    'I/L Arch Mage',
    'F/P Arch Mage'
  ],
  bowman: ['Archer', 'Hunter', 'Crossbowman', 'Ranger', 'Sniper', 'Bowmaster', 'Marksman'],
  thief: ['Rogue', 'Assassin', 'Bandit', 'Hermit', 'Chief Bandit', 'Night Lord', 'Shadower'],
  pirate: ['Pirate', 'Brawler', 'Gunslinger', 'Marauder', 'Outlaw', 'Buccaneer', 'Corsair']
}

export const ALL_JOBS: string[] = BRANCH_KEYS.flatMap((b) => JOBS_BY_BRANCH[b])

/** 'Any' + every job + every branch label — the valid values for a raid slot. */
export const SLOT_JOB_CHOICES: string[] = ['Any', ...BRANCH_KEYS.map((b) => BRANCH_LABELS[b]), ...ALL_JOBS]

export const SLOT_JOB_SET: Set<string> = new Set(SLOT_JOB_CHOICES)

export function branchOf(job: string): JobBranch {
  const j = job.trim().toLowerCase()
  for (const branch of BRANCH_KEYS) {
    if (JOBS_BY_BRANCH[branch].some((name) => name.toLowerCase() === j)) return branch
  }
  return 'beginner'
}

export function branchLabelOf(job: string): string {
  return BRANCH_LABELS[branchOf(job)]
}

/**
 * Does a character's job qualify for a template slot?
 * - 'Any' slots accept everyone.
 * - Branch slots ('Magician') accept any job in that branch.
 * - Exact jobs ('Bishop') accept only that job.
 */
export function jobQualifies(charJob: string, slotJob: string): boolean {
  if (!slotJob || slotJob === 'Any') return true
  if (charJob === slotJob) return true
  return branchOf(charJob) === slotJob.toLowerCase()
}
