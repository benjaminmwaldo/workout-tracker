import type { Session, SetEntry, ID } from './types'

export interface LastPerf {
  date: string
  sets: SetEntry[]
  topSet: SetEntry // heaviest set that session
}

export interface Records {
  maxWeight: { weight: number; reps: number; date: string } | null
  best1RM: { e1rm: number; weight: number; reps: number; date: string } | null
  maxReps: { weight: number; reps: number; date: string } | null
  sessionsCount: number
}

// Epley estimated 1-rep max
export function epley(weight: number, reps: number): number {
  if (reps <= 1) return weight
  return weight * (1 + reps / 30)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Most recent session (by date) that contains the exercise. */
export function lastPerformance(sessions: Session[], exerciseId: ID): LastPerf | null {
  const withEx = sessions
    .filter((s) => s.entries.some((e) => e.exerciseId === exerciseId && e.sets.length))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const s = withEx[0]
  if (!s) return null
  const entry = s.entries.find((e) => e.exerciseId === exerciseId)!
  const sets = entry.sets.filter((x) => x.reps > 0)
  if (!sets.length) return null
  const topSet = sets.reduce((best, cur) => (cur.weight > best.weight ? cur : best), sets[0])
  return { date: s.date, sets, topSet }
}

/** All-time records for an exercise across the profile's sessions. */
export function personalRecords(sessions: Session[], exerciseId: ID): Records {
  let maxWeight: Records['maxWeight'] = null
  let best1RM: Records['best1RM'] = null
  let maxReps: Records['maxReps'] = null
  let sessionsCount = 0
  for (const s of sessions) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    let counted = false
    for (const set of entry.sets) {
      if (set.reps <= 0) continue
      counted = true
      if (!maxWeight || set.weight > maxWeight.weight) {
        maxWeight = { weight: set.weight, reps: set.reps, date: s.date }
      }
      const e = epley(set.weight, set.reps)
      if (!best1RM || e > best1RM.e1rm) {
        best1RM = { e1rm: round1(e), weight: set.weight, reps: set.reps, date: s.date }
      }
      if (!maxReps || set.reps > maxReps.reps) {
        maxReps = { weight: set.weight, reps: set.reps, date: s.date }
      }
    }
    if (counted) sessionsCount++
  }
  return { maxWeight, best1RM, maxReps, sessionsCount }
}

/** Compact history for charting: one point (best e1RM that day) per session. */
export function exerciseTrend(
  sessions: Session[],
  exerciseId: ID,
): { date: string; e1rm: number; topWeight: number }[] {
  const pts: { date: string; e1rm: number; topWeight: number }[] = []
  for (const s of sessions) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    let best = 0
    let topWeight = 0
    for (const set of entry.sets) {
      if (set.reps <= 0) continue
      best = Math.max(best, epley(set.weight, set.reps))
      topWeight = Math.max(topWeight, set.weight)
    }
    if (best > 0) pts.push({ date: s.date, e1rm: round1(best), topWeight })
  }
  return pts.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  const dt = new Date(2000, (m || 1) - 1, d || 1)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** "225×8, 245×3, 245×3" summary of a set list. */
export function summarizeSets(sets: SetEntry[]): string {
  return sets
    .filter((s) => s.reps > 0)
    .map((s) => `${trimW(s.weight)}×${s.reps}`)
    .join(', ')
}

export function trimW(w: number): string {
  return Number.isInteger(w) ? String(w) : String(round1(w))
}
