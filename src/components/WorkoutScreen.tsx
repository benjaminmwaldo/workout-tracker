import { useMemo, useState } from 'react'
import type { Entry, ID, Session, SetEntry } from '../lib/types'
import { useApp } from '../lib/store'
import { lastPerformance, personalRecords, fmtDate, trimW } from '../lib/stats'
import { ExercisePicker } from './ExercisePicker'
import { IconPlus, IconClose, IconCheck, IconTrophy } from './Icons'

export function WorkoutScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { mySessions, myDraft, exerciseById, dispatch } = useApp()
  const [picking, setPicking] = useState(false)

  if (!myDraft) {
    // shouldn't happen, guard anyway
    onCancel()
    return null
  }
  // Explicit Session type so narrowing holds inside the callbacks below.
  const draft: Session = myDraft

  function update(next: Session) {
    dispatch({ type: 'UPDATE_DRAFT', session: next })
  }

  const recentIds = useMemo(() => {
    const seen: ID[] = []
    const sorted = [...mySessions].sort((a, b) => (a.date < b.date ? 1 : -1))
    for (const s of sorted) for (const e of s.entries) if (!seen.includes(e.exerciseId)) seen.push(e.exerciseId)
    return seen
  }, [mySessions])

  function addExercise(id: ID) {
    if (draft.entries.some((e) => e.exerciseId === id)) return
    const last = lastPerformance(mySessions, id)
    const firstSet: SetEntry = last
      ? { weight: last.topSet.weight, reps: last.topSet.reps }
      : { weight: 0, reps: 0 }
    update({ ...draft, entries: [...draft.entries, { exerciseId: id, sets: [firstSet] }] })
  }

  function updateEntry(exId: ID, mut: (e: Entry) => Entry) {
    update({ ...draft, entries: draft.entries.map((e) => (e.exerciseId === exId ? mut(e) : e)) })
  }

  function removeEntry(exId: ID) {
    update({ ...draft, entries: draft.entries.filter((e) => e.exerciseId !== exId) })
  }

  const totalSets = draft.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

  return (
    <>
      <div className="content">
        <div className="row between">
          <div>
            <div className="section-title" style={{ margin: 0 }}>Active workout</div>
            <div className="hint">{fmtDate(draft.date)} · {totalSets} sets done</div>
          </div>
          <button className="btn sm ghost danger" onClick={onCancel}>Discard</button>
        </div>

        {draft.entries.length === 0 && (
          <div className="card">
            <div className="hint" style={{ textAlign: 'center' }}>
              No exercises yet. Add one to start logging — you'll see your last weight and PR for each.
            </div>
          </div>
        )}

        {draft.entries.map((entry) => {
          const ex = exerciseById(entry.exerciseId)
          if (!ex) return null
          const last = lastPerformance(mySessions, entry.exerciseId)
          const pr = personalRecords(mySessions, entry.exerciseId)
          return (
            <div className="card ex-card" key={entry.exerciseId}>
              <div className="ex-head">
                <div>
                  <div className="ex-name">{ex.name}</div>
                  <div className="ex-group">{ex.muscleGroup}</div>
                </div>
                <button className="icon-btn" onClick={() => removeEntry(entry.exerciseId)}><IconClose size={18} /></button>
              </div>

              <div className="stat-row">
                <div className="stat last">
                  <div className="label">Last</div>
                  {last ? (
                    <>
                      <div className="big">{trimW(last.topSet.weight)}<span style={{ color: 'var(--faint)', fontWeight: 600 }}>×{last.topSet.reps}</span></div>
                      <div className="meta">{fmtDate(last.date)}</div>
                    </>
                  ) : (
                    <div className="big" style={{ color: 'var(--faint)' }}>—</div>
                  )}
                </div>
                <div className="stat pr">
                  <div className="label"><IconTrophy size={12} /> Record</div>
                  {pr.maxWeight ? (
                    <>
                      <div className="big">{trimW(pr.maxWeight.weight)}<span style={{ opacity: 0.6, fontWeight: 600 }}>×{pr.maxWeight.reps}</span></div>
                      <div className="meta">e1RM {pr.best1RM ? trimW(pr.best1RM.e1rm) : '—'} · {fmtDate(pr.maxWeight.date)}</div>
                    </>
                  ) : (
                    <div className="big" style={{ color: 'var(--faint)' }}>—</div>
                  )}
                </div>
              </div>

              <SetEditor
                entry={entry}
                onChange={(sets) => updateEntry(entry.exerciseId, (e) => ({ ...e, sets }))}
                prefill={last?.topSet}
              />
            </div>
          )
        })}

        <button className="btn big" onClick={() => setPicking(true)}><IconPlus size={20} /> Add exercise</button>

        <label className="field">
          Body weight (optional)
          <input
            type="number"
            inputMode="decimal"
            placeholder="lbs"
            value={draft.bodyweight ?? ''}
            onChange={(e) => update({ ...draft, bodyweight: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </label>

        <textarea
          className="notes"
          placeholder="Notes for this session…"
          value={draft.notes ?? ''}
          onChange={(e) => update({ ...draft, notes: e.target.value })}
        />

        <button className="btn primary big" onClick={onDone} style={{ marginTop: 4 }}>
          <IconCheck size={20} /> Finish workout
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onPick={addExercise}
          onClose={() => setPicking(false)}
          recentIds={recentIds}
          excludeIds={draft.entries.map((e) => e.exerciseId)}
        />
      )}
    </>
  )
}

function SetEditor({
  entry,
  onChange,
  prefill,
}: {
  entry: Entry
  onChange: (sets: SetEntry[]) => void
  prefill?: SetEntry
}) {
  function setField(i: number, field: 'weight' | 'reps', val: string) {
    const num = val === '' ? 0 : Number(val)
    onChange(entry.sets.map((s, idx) => (idx === i ? { ...s, [field]: num } : s)))
  }
  function toggleDone(i: number) {
    onChange(entry.sets.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s)))
  }
  function addSet() {
    const last = entry.sets[entry.sets.length - 1] || prefill || { weight: 0, reps: 0 }
    onChange([...entry.sets, { weight: last.weight, reps: last.reps }])
  }
  function removeSet(i: number) {
    onChange(entry.sets.filter((_, idx) => idx !== i))
  }

  return (
    <div className="set-list">
      <div className="set-head">
        <div style={{ textAlign: 'center' }}>#</div>
        <div style={{ textAlign: 'center' }}>Weight</div>
        <div style={{ textAlign: 'center' }}>Reps</div>
        <div />
      </div>
      {entry.sets.map((s, i) => (
        <div className={`set-line${s.done ? ' done' : ''}`} key={i}>
          <div className="idx">{i + 1}</div>
          <input
            className="num-input"
            type="number"
            inputMode="decimal"
            value={s.weight === 0 ? '' : s.weight}
            placeholder={prefill ? String(trimW(prefill.weight)) : '0'}
            onChange={(e) => setField(i, 'weight', e.target.value)}
          />
          <input
            className="num-input"
            type="number"
            inputMode="numeric"
            value={s.reps === 0 ? '' : s.reps}
            placeholder="0"
            onChange={(e) => setField(i, 'reps', e.target.value)}
          />
          <button
            className={`check${s.done ? ' on' : ''}`}
            onClick={() => toggleDone(i)}
            onDoubleClick={() => removeSet(i)}
            title="Tap to mark done · double-tap to remove"
          >
            <IconCheck size={20} />
          </button>
        </div>
      ))}
      <div className="set-actions">
        <button className="btn sm ghost grow" onClick={addSet}><IconPlus size={17} /> Add set</button>
        {entry.sets.length > 1 && (
          <button className="btn sm ghost" onClick={() => removeSet(entry.sets.length - 1)}>Remove</button>
        )}
      </div>
    </div>
  )
}
