export type ID = string

export interface Exercise {
  id: ID
  name: string
  muscleGroup: string
  archived?: boolean
}

export interface SetEntry {
  weight: number
  reps: number
  done?: boolean
}

export interface Entry {
  exerciseId: ID
  sets: SetEntry[]
}

export interface Session {
  id: ID
  date: string // ISO yyyy-mm-dd
  entries: Entry[]
  bodyweight?: number | null
  notes?: string
}

export interface Routine {
  id: ID
  name: string
  exerciseIds: ID[]
}

export interface Profile {
  id: ID
  name: string
}

export interface AppState {
  version: number
  profiles: Profile[]
  activeProfileId: ID
  exercises: Exercise[] // shared catalog across profiles
  routines: Routine[] // shared templates
  sessions: Record<ID, Session[]> // keyed by profileId
  draft: Record<ID, Session | null> // in-progress workout per profile
  sheetIds: Record<ID, string> // profileId -> Google spreadsheet id
}
