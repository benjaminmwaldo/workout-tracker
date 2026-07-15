import { useState } from 'react'
import type { ID, Session, SetEntry } from './lib/types'
import { useApp, uid, todayISO } from './lib/store'
import { lastPerformance } from './lib/stats'
import { HomeScreen, SessionDetail } from './components/HomeScreen'
import { WorkoutScreen } from './components/WorkoutScreen'
import { ExercisesScreen, ExerciseDetail } from './components/ExercisesScreen'
import { RoutinesScreen } from './components/RoutinesScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { Sheet } from './components/common'
import {
  IconHome, IconDumbbell, IconRoutine, IconSettings, IconCloud, IconCloudCheck, IconRefresh, IconChevron,
} from './components/Icons'

type Tab = 'home' | 'exercises' | 'routines' | 'settings'
type Sub =
  | { type: 'none' }
  | { type: 'workout' }
  | { type: 'session'; id: ID }
  | { type: 'exercise'; id: ID }

export default function App() {
  const { state, dispatch, activeProfile, mySessions, sync, syncNow, signInAndSync } = useApp()
  const [tab, setTab] = useState<Tab>('home')
  const [sub, setSub] = useState<Sub>({ type: 'none' })
  const [routineChooser, setRoutineChooser] = useState(false)

  function startFromRoutine(routineId: ID | null) {
    const routine = routineId ? state.routines.find((r) => r.id === routineId) : null
    const entries = (routine?.exerciseIds ?? []).map((exId) => {
      const last = lastPerformance(mySessions, exId)
      const first: SetEntry = last ? { weight: last.topSet.weight, reps: last.topSet.reps } : { weight: 0, reps: 0 }
      return { exerciseId: exId, sets: [first] }
    })
    const session: Session = { id: uid('s'), date: todayISO(), entries, bodyweight: null, notes: '' }
    dispatch({ type: 'START_DRAFT', session })
    setRoutineChooser(false)
    setSub({ type: 'workout' })
  }

  function finishWorkout() {
    dispatch({ type: 'FINISH_DRAFT' })
    setSub({ type: 'none' })
    setTab('home')
  }
  function cancelWorkout() {
    if (confirm('Discard this workout?')) {
      dispatch({ type: 'DISCARD_DRAFT' })
      setSub({ type: 'none' })
    }
  }

  // ---- render body ----
  let body: React.ReactNode
  if (sub.type === 'workout') {
    body = <WorkoutScreen onDone={finishWorkout} onCancel={cancelWorkout} />
  } else if (sub.type === 'session') {
    body = <SessionDetail id={sub.id} onBack={() => setSub({ type: 'none' })} />
  } else if (sub.type === 'exercise') {
    body = <ExerciseDetail id={sub.id} onBack={() => setSub({ type: 'none' })} />
  } else if (tab === 'home') {
    body = (
      <HomeScreen
        onStart={() => setSub({ type: 'workout' })}
        onChooseRoutine={() => setRoutineChooser(true)}
        onOpenSession={(id) => setSub({ type: 'session', id })}
      />
    )
  } else if (tab === 'exercises') {
    body = <ExercisesScreen onOpen={(id) => setSub({ type: 'exercise', id })} />
  } else if (tab === 'routines') {
    body = <RoutinesScreen onStartRoutine={(id) => startFromRoutine(id)} />
  } else {
    body = <SettingsScreen />
  }

  const inWorkout = sub.type === 'workout'
  const title = inWorkout
    ? 'Workout'
    : sub.type === 'exercise'
      ? 'Exercise'
      : sub.type === 'session'
        ? 'Session'
        : tab === 'home' ? 'Workout Tracker'
          : tab === 'exercises' ? 'Exercises'
            : tab === 'routines' ? 'Routines' : 'Settings'

  return (
    <div className="app">
      <header className="appbar">
        <div className="brand">
          <div className="logo"><IconDumbbell size={22} /></div>
          <div>
            <h1>{title}</h1>
            {!inWorkout && <div className="sub">Pick your weight with confidence</div>}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {state.profiles.length > 1 && (
            <div className="profile-switch">
              {state.profiles.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  className={p.id === activeProfile.id ? 'active' : ''}
                  onClick={() => { dispatch({ type: 'SET_PROFILE', id: p.id }); setSub({ type: 'none' }) }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {sync.configured && (
            <button
              className={`icon-btn${sync.signedIn ? ' on' : ''}`}
              title={sync.signedIn ? 'Sync now' : 'Sign in to sync'}
              onClick={() => (sync.signedIn ? syncNow() : signInAndSync().catch(() => {}))}
            >
              {sync.syncing ? <IconRefresh size={19} /> : sync.signedIn ? <IconCloudCheck size={19} /> : <IconCloud size={19} />}
            </button>
          )}
        </div>
      </header>

      {body}

      {!inWorkout && (
        <nav className="tabbar">
          <TabButton icon={<IconHome />} label="Home" active={tab === 'home' && sub.type === 'none'} onClick={() => { setTab('home'); setSub({ type: 'none' }) }} />
          <TabButton icon={<IconDumbbell />} label="Exercises" active={tab === 'exercises'} onClick={() => { setTab('exercises'); setSub({ type: 'none' }) }} />
          <TabButton icon={<IconRoutine />} label="Routines" active={tab === 'routines'} onClick={() => { setTab('routines'); setSub({ type: 'none' }) }} />
          <TabButton icon={<IconSettings />} label="Settings" active={tab === 'settings'} onClick={() => { setTab('settings'); setSub({ type: 'none' }) }} />
        </nav>
      )}

      {routineChooser && (
        <Sheet title="Start a workout" onClose={() => setRoutineChooser(false)}>
          <button className="btn primary" onClick={() => startFromRoutine(null)}>Empty workout</button>
          <div className="divider" style={{ margin: '10px 0 4px' }} />
          {state.routines.length === 0 && <div className="hint">No routines yet — create one in the Routines tab.</div>}
          {state.routines.map((r) => (
            <button key={r.id} className="list-item" onClick={() => startFromRoutine(r.id)}>
              <div>
                <div className="li-title">{r.name}</div>
                <div className="li-sub">{r.exerciseIds.length} exercises</div>
              </div>
              <span className="chev"><IconChevron size={18} /></span>
            </button>
          ))}
        </Sheet>
      )}
    </div>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      {icon}
      {label}
    </button>
  )
}
