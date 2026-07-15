import { useMemo, useState } from 'react'
import type { Exercise, ID } from '../lib/types'
import { useApp, uid } from '../lib/store'
import { Sheet } from './common'

const GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Calves',
  'Core', 'Forearms', 'Neck', 'Other',
]

/**
 * Pick one or more exercises from the shared catalog, or create a new one.
 * `recentIds` surfaces recently used exercises first. `excludeIds` hides ones
 * already added.
 */
export function ExercisePicker({
  onPick,
  onClose,
  recentIds = [],
  excludeIds = [],
}: {
  onPick: (id: ID) => void
  onClose: () => void
  recentIds?: ID[]
  excludeIds?: ID[]
}) {
  const { state, dispatch } = useApp()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('Other')

  const exclude = new Set(excludeIds)
  const recentRank = new Map(recentIds.map((id, i) => [id, i]))

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = state.exercises.filter((e) => !e.archived && !exclude.has(e.id))
    const filtered = query
      ? list.filter((e) => e.name.toLowerCase().includes(query) || e.muscleGroup.toLowerCase().includes(query))
      : list
    return filtered.sort((a, b) => {
      const ra = recentRank.has(a.id) ? recentRank.get(a.id)! : 999
      const rb = recentRank.has(b.id) ? recentRank.get(b.id)! : 999
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name)
    })
  }, [q, state.exercises, excludeIds.join(','), recentIds.join(',')])

  function create() {
    const name = newName.trim()
    if (!name) return
    const ex: Exercise = { id: uid('ex'), name, muscleGroup: newGroup }
    dispatch({ type: 'ADD_EXERCISE', exercise: ex })
    onPick(ex.id)
    onClose()
  }

  if (creating) {
    return (
      <Sheet title="New exercise" onClose={() => setCreating(false)}>
        <label className="field">
          Name
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Incline db press"
          />
        </label>
        <label className="field" style={{ marginTop: 12 }}>
          Muscle group
          <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
            {GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn grow ghost" onClick={() => setCreating(false)}>Back</button>
          <button className="btn primary grow" onClick={create} disabled={!newName.trim()}>
            Create & add
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <input
        className="search"
        placeholder="Search exercises…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <button className="btn primary" style={{ marginTop: 10 }} onClick={() => { setNewName(q); setCreating(true) }}>
        ＋ Create new exercise{q.trim() ? ` "${q.trim()}"` : ''}
      </button>
      <div className="divider" style={{ margin: '10px 0 4px' }} />
      <div className="list" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        {results.map((e) => (
          <button
            key={e.id}
            className="list-item"
            onClick={() => { onPick(e.id); onClose() }}
          >
            <div>
              <div className="li-title">{e.name}</div>
              <div className="li-sub">{e.muscleGroup}{recentRank.has(e.id) ? ' · recent' : ''}</div>
            </div>
            <span className="chev">＋</span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="hint" style={{ padding: 16, textAlign: 'center' }}>
            No matches. Create it above.
          </div>
        )}
      </div>
    </Sheet>
  )
}
