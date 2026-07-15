import { useMemo, useState } from 'react'
import type { ID } from '../lib/types'
import { useApp } from '../lib/store'
import {
  personalRecords, lastPerformance, exerciseTrend, fmtDate, summarizeSets, trimW,
} from '../lib/stats'
import { Sparkline, EmptyState } from './common'
import { IconArrowLeft, IconDumbbell, IconTrend, IconHistory, IconChevron } from './Icons'

export function ExercisesScreen({ onOpen }: { onOpen: (id: ID) => void }) {
  const { state, mySessions } = useApp()
  const [q, setQ] = useState('')

  // rank: exercises with history first, then by name
  const historyCount = useMemo(() => {
    const m = new Map<ID, number>()
    for (const s of mySessions) for (const e of s.entries) m.set(e.exerciseId, (m.get(e.exerciseId) || 0) + 1)
    return m
  }, [mySessions])

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return state.exercises
      .filter((e) => !e.archived)
      .filter((e) => !query || e.name.toLowerCase().includes(query) || e.muscleGroup.toLowerCase().includes(query))
      .sort((a, b) => {
        const ha = historyCount.get(a.id) || 0
        const hb = historyCount.get(b.id) || 0
        if (ha !== hb) return hb - ha
        return a.name.localeCompare(b.name)
      })
  }, [q, state.exercises, historyCount])

  return (
    <div className="content">
      <input className="search" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="hint">{list.length} exercises · sorted by how often you've logged them</div>
      <div className="list">
        {list.map((e) => {
          const last = lastPerformance(mySessions, e.id)
          const count = historyCount.get(e.id) || 0
          return (
            <button key={e.id} className="list-item" onClick={() => onOpen(e.id)}>
              <div style={{ minWidth: 0 }}>
                <div className="li-title">{e.name}</div>
                <div className="li-sub">
                  {e.muscleGroup}
                  {last ? ` · last ${trimW(last.topSet.weight)}×${last.topSet.reps}` : ' · no history'}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {count > 0 && <span className="pill">{count}×</span>}
                <span className="chev"><IconChevron size={17} /></span>
              </div>
            </button>
          )
        })}
        {list.length === 0 && <EmptyState icon={<IconDumbbell size={26} />} title="No matches" />}
      </div>
    </div>
  )
}

export function ExerciseDetail({ id, onBack }: { id: ID; onBack: () => void }) {
  const { exerciseById, mySessions, dispatch, state } = useApp()
  const ex = exerciseById(id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(ex?.name ?? '')
  const [group, setGroup] = useState(ex?.muscleGroup ?? 'Other')

  const pr = useMemo(() => personalRecords(mySessions, id), [mySessions, id])
  const last = useMemo(() => lastPerformance(mySessions, id), [mySessions, id])
  const trend = useMemo(() => exerciseTrend(mySessions, id), [mySessions, id])
  const history = useMemo(
    () =>
      [...mySessions]
        .filter((s) => s.entries.some((e) => e.exerciseId === id))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [mySessions, id],
  )

  if (!ex) return <div className="content"><EmptyState icon={<IconDumbbell size={26} />} title="Exercise not found" /></div>

  function saveEdit() {
    dispatch({ type: 'UPDATE_EXERCISE', exercise: { ...ex!, name: name.trim() || ex!.name, muscleGroup: group } })
    setEditing(false)
  }

  const groups = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Calves', 'Core', 'Forearms', 'Neck', 'Other']

  return (
    <div className="content">
      <button className="btn sm ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}><IconArrowLeft size={17} /> Back</button>

      {editing ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field">Muscle group
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <div className="row">
            <button className="btn ghost grow" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn primary grow" onClick={saveEdit}>Save</button>
          </div>
        </div>
      ) : (
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>{ex.name}</h2>
            <div className="ex-group">{ex.muscleGroup}</div>
          </div>
          <button className="btn sm ghost" onClick={() => { setName(ex.name); setGroup(ex.muscleGroup); setEditing(true) }}>Edit</button>
        </div>
      )}

      <div className="stat-row">
        <div className="stat last">
          <div className="label">Last</div>
          <div className="big">{last ? `${trimW(last.topSet.weight)}×${last.topSet.reps}` : '—'}</div>
          <div className="meta">{last ? fmtDate(last.date) : 'no history'}</div>
        </div>
        <div className="stat pr">
          <div className="label">Max weight</div>
          <div className="big">{pr.maxWeight ? `${trimW(pr.maxWeight.weight)}×${pr.maxWeight.reps}` : '—'}</div>
          <div className="meta">{pr.maxWeight ? fmtDate(pr.maxWeight.date) : ''}</div>
        </div>
      </div>
      <div className="stat-row">
        <div className="stat">
          <div className="label">Best est. 1RM</div>
          <div className="big">{pr.best1RM ? trimW(pr.best1RM.e1rm) : '—'}</div>
          <div className="meta">{pr.best1RM ? `from ${trimW(pr.best1RM.weight)}×${pr.best1RM.reps}` : ''}</div>
        </div>
        <div className="stat">
          <div className="label">Times logged</div>
          <div className="big">{pr.sessionsCount}</div>
          <div className="meta">sessions</div>
        </div>
      </div>

      {trend.length >= 2 && (
        <div className="card tight">
          <div className="section-title row" style={{ margin: '0 0 8px', gap: 6, alignItems: 'center' }}><IconTrend size={13} /> Est. 1RM trend</div>
          <Sparkline values={trend.map((t) => t.e1rm)} color="#c9f24d" />
          <div className="row between hint" style={{ marginTop: 4 }}>
            <span>{fmtDate(trend[0].date)}</span>
            <span>{fmtDate(trend[trend.length - 1].date)}</span>
          </div>
        </div>
      )}

      <div className="section-title">History</div>
      {history.length === 0 ? (
        <EmptyState icon={<IconHistory size={26} />} title="No history yet" sub="Log this exercise in a workout to start tracking." />
      ) : (
        <div className="list">
          {history.map((s) => {
            const entry = s.entries.find((e) => e.exerciseId === id)!
            return (
              <div className="card tight" key={s.id}>
                <div className="row between">
                  <div className="li-title">{fmtDate(s.date)}</div>
                  {s.bodyweight != null && <span className="pill">{s.bodyweight} bw</span>}
                </div>
                <div className="li-sub">{summarizeSets(entry.sets)}</div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ height: 8 }} />
      <div className="hint">Catalog shared with all profiles · {state.exercises.length} exercises total</div>
    </div>
  )
}
