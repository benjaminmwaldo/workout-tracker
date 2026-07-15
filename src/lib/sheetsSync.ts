// Google Sheets sync for the workout tracker.
//
// Model: each signed-in user has their OWN spreadsheet (single writer), so we
// never diff — sync is pull-then-push with a full-snapshot overwrite. The sheet
// is human-readable: one row per set. localStorage stays the source of truth for
// offline use; the sheet is the cloud backup + cross-device restore.

import type { Exercise, Routine, Session, SetEntry, Entry } from './types'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const TABS = ['Exercises', 'Sessions', 'Sets', 'Routines'] as const

export interface SyncData {
  exercises: Exercise[]
  routines: Routine[]
  sessions: Session[]
}

async function api(
  token: string,
  path: string,
  opts: { method?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<any> {
  const url = new URL(BASE + path)
  if (opts.params) for (const [k, v] of Object.entries(opts.params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.status === 204 ? null : res.json()
}

/** Parse a spreadsheet id out of a full URL or accept a bare id. */
export function parseSheetId(input: string): string | null {
  const trimmed = input.trim()
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed
  return null
}

export function sheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
}

/** Create a fresh spreadsheet with our four tabs. Returns the new id. */
export async function createSheet(token: string, title: string): Promise<string> {
  const res = await api(token, '', {
    method: 'POST',
    body: {
      properties: { title },
      sheets: TABS.map((t) => ({ properties: { title: t } })),
    },
  })
  return res.spreadsheetId as string
}

/** Ensure the given sheet has all required tabs (adds any missing). */
export async function ensureTabs(token: string, sheetId: string): Promise<void> {
  const meta = await api(token, `/${sheetId}`, { params: { fields: 'sheets.properties.title' } })
  const have = new Set<string>((meta.sheets || []).map((s: any) => s.properties.title))
  const missing = TABS.filter((t) => !have.has(t))
  if (missing.length) {
    await api(token, `/${sheetId}:batchUpdate`, {
      method: 'POST',
      body: { requests: missing.map((t) => ({ addSheet: { properties: { title: t } } })) },
    })
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Read the sheet and reconstruct the app data. */
export async function pullState(token: string, sheetId: string): Promise<SyncData> {
  await ensureTabs(token, sheetId)
  const byTab: Record<string, string[][]> = {}
  for (const t of TABS) {
    const r = await api(token, `/${sheetId}/values/${encodeURIComponent(t)}!A2:Z100000`)
    byTab[t] = r.values || []
  }

  const exercises: Exercise[] = (byTab['Exercises'] || [])
    .filter((r) => r[0])
    .map((r) => ({ id: r[0], name: r[1] || r[0], muscleGroup: r[2] || 'Other', archived: r[3] === '1' }))

  const routines: Routine[] = (byTab['Routines'] || [])
    .filter((r) => r[0])
    .map((r) => ({ id: r[0], name: r[1] || 'Routine', exerciseIds: (r[2] || '').split('|').filter(Boolean) }))

  const sessMap = new Map<string, Session>()
  const order: string[] = []
  for (const r of byTab['Sessions'] || []) {
    if (!r[0]) continue
    sessMap.set(r[0], {
      id: r[0],
      date: r[1] || '',
      bodyweight: r[2] === '' || r[2] == null ? null : num(r[2]),
      notes: r[3] || '',
      entries: [],
    })
    order.push(r[0])
  }
  // Sets rows: sessionId, exerciseId, setIndex, weight, reps, done
  const entryMap = new Map<string, Entry>() // key sessionId|exerciseId
  for (const r of byTab['Sets'] || []) {
    const sessionId = r[0]
    const exerciseId = r[1]
    if (!sessionId || !exerciseId) continue
    const s = sessMap.get(sessionId)
    if (!s) continue
    const key = sessionId + '|' + exerciseId
    let entry = entryMap.get(key)
    if (!entry) {
      entry = { exerciseId, sets: [] }
      entryMap.set(key, entry)
      s.entries.push(entry)
    }
    const set: SetEntry = { weight: num(r[3]), reps: num(r[4]), done: r[5] === '1' }
    entry.sets.push(set)
  }
  const sessions = order.map((id) => sessMap.get(id)!).filter(Boolean)
  return { exercises, routines, sessions }
}

/** Overwrite the sheet with a full snapshot. */
export async function pushState(token: string, sheetId: string, data: SyncData): Promise<void> {
  await ensureTabs(token, sheetId)

  const exRows = [['id', 'name', 'muscleGroup', 'archived'], ...data.exercises.map((e) => [e.id, e.name, e.muscleGroup, e.archived ? '1' : ''])]
  const sessRows = [['id', 'date', 'bodyweight', 'notes'], ...data.sessions.map((s) => [s.id, s.date, s.bodyweight == null ? '' : String(s.bodyweight), s.notes || ''])]
  const setRows: string[][] = [['sessionId', 'exerciseId', 'setIndex', 'weight', 'reps', 'done']]
  for (const s of data.sessions) {
    for (const e of s.entries) {
      e.sets.forEach((set, i) => {
        setRows.push([s.id, e.exerciseId, String(i + 1), String(set.weight), String(set.reps), set.done ? '1' : ''])
      })
    }
  }
  const rtRows = [['id', 'name', 'exerciseIds'], ...data.routines.map((r) => [r.id, r.name, r.exerciseIds.join('|')])]

  // Clear then write each tab (a shrinking dataset must not leave stale rows).
  await api(token, `/${sheetId}/values:batchClear`, {
    method: 'POST',
    body: { ranges: TABS.map((t) => `${t}!A1:Z100000`) },
  })
  await api(token, `/${sheetId}/values:batchUpdate`, {
    method: 'POST',
    body: {
      valueInputOption: 'RAW',
      data: [
        { range: 'Exercises!A1', values: exRows },
        { range: 'Sessions!A1', values: sessRows },
        { range: 'Sets!A1', values: setRows },
        { range: 'Routines!A1', values: rtRows },
      ],
    },
  })
}

/** Merge pulled cloud data with local, keyed by id. Local wins on conflicts
 *  (this device's unsynced edits), cloud-only items are added (restore). */
export function mergeData(local: SyncData, cloud: SyncData): SyncData {
  const byId = <T extends { id: string }>(local: T[], cloud: T[]): T[] => {
    const map = new Map<string, T>()
    for (const c of cloud) map.set(c.id, c)
    for (const l of local) map.set(l.id, l) // local overrides
    return [...map.values()]
  }
  const sessions = byId(local.sessions, cloud.sessions).sort((a, b) => (a.date < b.date ? -1 : 1))
  return {
    exercises: byId(local.exercises, cloud.exercises),
    routines: byId(local.routines, cloud.routines),
    sessions,
  }
}
