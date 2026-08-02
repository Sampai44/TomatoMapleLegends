/**
 * Job list, copied from `shared/jobs.ts`. Used by raid slot validation and
 * old-to-new-skin job matching.
 */
export const BRANCH_KEYS = ['beginner', 'warrior', 'magician', 'bowman', 'thief', 'pirate']

export const BRANCH_LABELS = {
  beginner: 'Beginner',
  warrior: 'Warrior',
  magician: 'Magician',
  bowman: 'Bowman',
  thief: 'Thief',
  pirate: 'Pirate'
}

export const JOBS_BY_BRANCH = {
  beginner: ['Beginner'],
  warrior: ['Warrior', 'Fighter', 'Page', 'Spearman', 'Crusader', 'White Knight', 'Dragon Knight', 'Hero', 'Paladin', 'Dark Knight'],
  magician: ['Magician', 'Cleric', 'I/L Wizard', 'F/P Wizard', 'Priest', 'I/L Mage', 'F/P Mage', 'Bishop', 'I/L Arch Mage', 'F/P Arch Mage'],
  bowman: ['Archer', 'Hunter', 'Crossbowman', 'Ranger', 'Sniper', 'Bowmaster', 'Marksman'],
  thief: ['Rogue', 'Assassin', 'Bandit', 'Hermit', 'Chief Bandit', 'Night Lord', 'Shadower'],
  pirate: ['Pirate', 'Brawler', 'Gunslinger', 'Marauder', 'Outlaw', 'Buccaneer', 'Corsair']
}

export const ALL_JOBS = BRANCH_KEYS.flatMap((b) => JOBS_BY_BRANCH[b])

export const SLOT_JOB_CHOICES = ['Any', ...BRANCH_KEYS.map((b) => BRANCH_LABELS[b]), ...ALL_JOBS]

export function branchOf(job) {
  const j = job.trim().toLowerCase()
  for (const branch of BRANCH_KEYS) {
    if (JOBS_BY_BRANCH[branch].some((name) => name.toLowerCase() === j)) return branch
  }
  return 'beginner'
}

export function branchLabelOf(job) {
  return BRANCH_LABELS[branchOf(job)]
}

export function jobQualifies(charJob, slotJob) {
  if (!slotJob || slotJob === 'Any') return true
  if (charJob === slotJob) return true
  return branchOf(charJob) === slotJob.toLowerCase()
}

export function isValidSlotJob(job) {
  return SLOT_JOB_CHOICES.includes(job)
}

export const SLOT_JOB_SET = new Set(SLOT_JOB_CHOICES)