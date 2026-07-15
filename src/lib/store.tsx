import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import type { AppState, Exercise, ID, Profile, Routine, Session } from './types'
import starter from '../data/starter.json'
import { ensureAccessToken, isSignedIn, signOut as gSignOut, isConfigured } from './googleAuth'
import { createSheet, pullState, pushState, mergeData, parseSheetId, type SyncData } from './sheetsSync'

const STORAGE_KEY = 'workout-tracker-v2'
const VERSION = 2

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---- initial state (generic starter data only — no personal data in the bundle) ----
function buildInitial(): AppState {
  const me: Profile = { id: 'me', name: 'Me' }
  return {
    version: VERSION,
    profiles: [me],
    activeProfileId: me.id,
    exercises: (starter.exercises as Exercise[]).map((e) => ({ ...e })),
    routines: (starter.routines as Routine[]).map((r) => ({ ...r })),
    sessions: { [me.id]: [] },
    draft: { [me.id]: null },
    sheetIds: {},
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed && parsed.version === VERSION) return { ...buildInitial(), ...parsed, sheetIds: parsed.sheetIds || {} }
    }
  } catch {
    /* ignore */
  }
  return buildInitial()
}

function save(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}

// ---- actions ----
type Action =
  | { type: 'SET_PROFILE'; id: ID }
  | { type: 'ADD_PROFILE'; name: string }
  | { type: 'ADD_EXERCISE'; exercise: Exercise }
  | { type: 'UPDATE_EXERCISE'; exercise: Exercise }
  | { type: 'ADD_ROUTINE'; routine: Routine }
  | { type: 'UPDATE_ROUTINE'; routine: Routine }
  | { type: 'DELETE_ROUTINE'; id: ID }
  | { type: 'START_DRAFT'; session: Session }
  | { type: 'UPDATE_DRAFT'; session: Session }
  | { type: 'DISCARD_DRAFT' }
  | { type: 'FINISH_DRAFT' }
  | { type: 'DELETE_SESSION'; id: ID }
  | { type: 'SET_SHEET_ID'; profileId: ID; sheetId: string }
  | { type: 'MERGE_SYNC'; data: SyncData } // replace shared catalog/routines + active profile's sessions
  | { type: 'IMPORT_HISTORY'; exercises: Exercise[]; sessions: Session[] }
  | { type: 'REPLACE_STATE'; state: AppState }

function mergeById<T extends { id: string }>(base: T[], incoming: T[], preferIncoming = true): T[] {
  const map = new Map<string, T>()
  const first = preferIncoming ? base : incoming
  const second = preferIncoming ? incoming : base
  for (const x of first) map.set(x.id, x)
  for (const x of second) map.set(x.id, x)
  return [...map.values()]
}

function reducer(state: AppState, action: Action): AppState {
  const pid = state.activeProfileId
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, activeProfileId: action.id }
    case 'ADD_PROFILE': {
      const p: Profile = { id: uid('p'), name: action.name.trim() || 'New' }
      return {
        ...state,
        profiles: [...state.profiles, p],
        sessions: { ...state.sessions, [p.id]: [] },
        draft: { ...state.draft, [p.id]: null },
        activeProfileId: p.id,
      }
    }
    case 'ADD_EXERCISE':
      return { ...state, exercises: [...state.exercises, action.exercise] }
    case 'UPDATE_EXERCISE':
      return { ...state, exercises: state.exercises.map((e) => (e.id === action.exercise.id ? action.exercise : e)) }
    case 'ADD_ROUTINE':
      return { ...state, routines: [...state.routines, action.routine] }
    case 'UPDATE_ROUTINE':
      return { ...state, routines: state.routines.map((r) => (r.id === action.routine.id ? action.routine : r)) }
    case 'DELETE_ROUTINE':
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) }
    case 'START_DRAFT':
    case 'UPDATE_DRAFT':
      return { ...state, draft: { ...state.draft, [pid]: action.session } }
    case 'DISCARD_DRAFT':
      return { ...state, draft: { ...state.draft, [pid]: null } }
    case 'FINISH_DRAFT': {
      const d = state.draft[pid]
      if (!d) return state
      const entries = d.entries
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.reps > 0 && s.weight >= 0) }))
        .filter((e) => e.sets.length > 0)
      if (entries.length === 0 && d.bodyweight == null) {
        return { ...state, draft: { ...state.draft, [pid]: null } }
      }
      const finished: Session = { ...d, entries }
      return {
        ...state,
        sessions: { ...state.sessions, [pid]: [...(state.sessions[pid] || []), finished] },
        draft: { ...state.draft, [pid]: null },
      }
    }
    case 'DELETE_SESSION':
      return { ...state, sessions: { ...state.sessions, [pid]: (state.sessions[pid] || []).filter((s) => s.id !== action.id) } }
    case 'SET_SHEET_ID':
      return { ...state, sheetIds: { ...state.sheetIds, [action.profileId]: action.sheetId } }
    case 'MERGE_SYNC':
      return {
        ...state,
        exercises: action.data.exercises,
        routines: action.data.routines,
        sessions: { ...state.sessions, [pid]: action.data.sessions },
      }
    case 'IMPORT_HISTORY': {
      const exercises = mergeById(state.exercises, action.exercises, false) // keep existing on id clash
      const sessions = mergeById(state.sessions[pid] || [], action.sessions, true).sort((a, b) => (a.date < b.date ? -1 : 1))
      return { ...state, exercises, sessions: { ...state.sessions, [pid]: sessions } }
    }
    case 'REPLACE_STATE':
      return action.state
    default:
      return state
  }
}

// ---- sync status (transient, not persisted) ----
export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  syncing: boolean
  lastSyncAt: number | null
  error: string | null
}

interface Ctx {
  state: AppState
  dispatch: React.Dispatch<Action>
  activeProfile: Profile
  mySessions: Session[]
  myDraft: Session | null
  exerciseById: (id: ID) => Exercise | undefined
  sync: SyncStatus
  signInAndSync: () => Promise<void>
  syncNow: () => Promise<void>
  signOut: () => void
  connectSheet: (urlOrId: string) => void
  importHistory: (data: { exercises: Exercise[]; sessions: Session[] }) => void
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => save(state), [state])

  const [sync, setSync] = useState<SyncStatus>({
    configured: isConfigured(),
    signedIn: isSignedIn(),
    syncing: false,
    lastSyncAt: null,
    error: null,
  })

  // keep a ref to latest state so async sync reads fresh data
  const stateRef = useRef(state)
  stateRef.current = state

  async function runSync(interactive: boolean) {
    const s = stateRef.current
    const pid = s.activeProfileId
    setSync((p) => ({ ...p, syncing: true, error: null }))
    try {
      const token = await ensureAccessToken({ interactive })
      let sheetId = s.sheetIds[pid]
      if (!sheetId) {
        const name = s.profiles.find((p) => p.id === pid)?.name || 'Me'
        sheetId = await createSheet(token, `Workout Tracker — ${name}`)
        dispatch({ type: 'SET_SHEET_ID', profileId: pid, sheetId })
      }
      const local: SyncData = {
        exercises: s.exercises,
        routines: s.routines,
        sessions: s.sessions[pid] || [],
      }
      const cloud = await pullState(token, sheetId)
      const merged = mergeData(local, cloud)
      dispatch({ type: 'MERGE_SYNC', data: merged })
      await pushState(token, sheetId, merged)
      setSync({ configured: true, signedIn: true, syncing: false, lastSyncAt: Date.now(), error: null })
    } catch (e) {
      setSync((p) => ({ ...p, syncing: false, signedIn: isSignedIn(), error: (e as Error).message }))
      throw e
    }
  }

  const ctx: Ctx = {
    state,
    dispatch,
    activeProfile: state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0],
    mySessions: state.sessions[state.activeProfileId] || [],
    myDraft: state.draft[state.activeProfileId] || null,
    exerciseById: ((): ((id: ID) => Exercise | undefined) => {
      const m = new Map(state.exercises.map((e) => [e.id, e]))
      return (id: ID) => m.get(id)
    })(),
    sync,
    signInAndSync: () => runSync(true),
    syncNow: () => runSync(false).catch(() => runSync(true)),
    signOut: () => {
      gSignOut()
      setSync((p) => ({ ...p, signedIn: false, lastSyncAt: null }))
    },
    connectSheet: (urlOrId: string) => {
      const id = parseSheetId(urlOrId)
      if (!id) {
        setSync((p) => ({ ...p, error: 'Could not read a sheet ID from that.' }))
        return
      }
      dispatch({ type: 'SET_SHEET_ID', profileId: state.activeProfileId, sheetId: id })
      setSync((p) => ({ ...p, error: null }))
    },
    importHistory: (data) => dispatch({ type: 'IMPORT_HISTORY', exercises: data.exercises, sessions: data.sessions }),
  }

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { todayISO, VERSION, STORAGE_KEY, buildInitial }
