import { useState } from 'react'
import type { ID, Routine } from '../lib/types'
import { useApp, uid } from '../lib/store'
import { EmptyState } from './common'
import { ExercisePicker } from './ExercisePicker'

export function RoutinesScreen({ onStartRoutine }: { onStartRoutine: (routineId: ID) => void }) {
  const { state, dispatch, exerciseById } = useApp()
  const [editing, setEditing] = useState<Routine | null>(null)

  function newRoutine() {
    setEditing({ id: uid('rt'), name: '', exerciseIds: [] })
  }

  if (editing) {
    return <RoutineEditor routine={editing} onClose={() => setEditing(null)} />
  }

  return (
    <div className="content">
      <div className="row between">
        <div className="section-title" style={{ margin: 0 }}>Routines</div>
        <button className="btn sm primary" onClick={newRoutine}>＋ New</button>
      </div>
      <div className="hint">Templates to start a workout fast. Shared across profiles — you can still add or swap exercises mid-workout.</div>
      {state.routines.length === 0 ? (
        <EmptyState icon="📋" title="No routines yet" sub="Create one to start workouts in a tap." />
      ) : (
        <div className="list">
          {state.routines.map((r) => (
            <div className="card tight" key={r.id}>
              <div className="row between">
                <div style={{ minWidth: 0 }}>
                  <div className="li-title">{r.name}</div>
                  <div className="li-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.exerciseIds.map((id) => exerciseById(id)?.name).filter(Boolean).join(', ') || 'Empty'}
                  </div>
                </div>
                <span className="pill accent">{r.exerciseIds.length}</span>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn sm primary grow" onClick={() => onStartRoutine(r.id)}>Start</button>
                <button className="btn sm ghost" onClick={() => setEditing(r)}>Edit</button>
                <button
                  className="btn sm ghost danger"
                  onClick={() => { if (confirm(`Delete "${r.name}"?`)) dispatch({ type: 'DELETE_ROUTINE', id: r.id }) }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RoutineEditor({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const { state, dispatch, exerciseById } = useApp()
  const [name, setName] = useState(routine.name)
  const [ids, setIds] = useState<ID[]>(routine.exerciseIds)
  const [picking, setPicking] = useState(false)
  const exists = state.routines.some((r) => r.id === routine.id)

  function save() {
    const r: Routine = { ...routine, name: name.trim() || 'Routine', exerciseIds: ids }
    dispatch({ type: exists ? 'UPDATE_ROUTINE' : 'ADD_ROUTINE', routine: r })
    onClose()
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    setIds(next)
  }

  return (
    <div className="content">
      <button className="btn sm ghost" onClick={onClose} style={{ alignSelf: 'flex-start' }}>← Cancel</button>
      <label className="field">Routine name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" />
      </label>
      <div className="section-title">Exercises</div>
      {ids.length === 0 && <div className="hint">No exercises yet — add some below.</div>}
      <div className="list">
        {ids.map((id, i) => (
          <div className="card tight row between" key={id}>
            <div className="li-title" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i + 1}. {exerciseById(id)?.name ?? 'Unknown'}
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="btn sm ghost" onClick={() => move(i, 1)} disabled={i === ids.length - 1}>↓</button>
              <button className="btn sm ghost danger" onClick={() => setIds(ids.filter((x) => x !== id))}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost" onClick={() => setPicking(true)}>＋ Add exercise</button>
      <button className="btn primary big" onClick={save}>Save routine</button>

      {picking && (
        <ExercisePicker
          onPick={(id) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
          onClose={() => setPicking(false)}
          excludeIds={ids}
        />
      )}
    </div>
  )
}
