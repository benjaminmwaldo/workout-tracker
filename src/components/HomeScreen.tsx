import type { ID, Session } from '../lib/types'
import { useApp, uid, todayISO } from '../lib/store'
import { fmtDate, summarizeSets } from '../lib/stats'
import { EmptyState } from './common'
import { IconPlus, IconArrowLeft, IconDumbbell, IconHistory, IconChevron } from './Icons'

export function HomeScreen({
  onStart,
  onOpenSession,
  onChooseRoutine,
}: {
  onStart: () => void
  onOpenSession: (id: ID) => void
  onChooseRoutine: () => void
}) {
  const { mySessions, myDraft, activeProfile, dispatch, exerciseById } = useApp()

  const recent = [...mySessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
  const lastBw = [...mySessions].reverse().find((s) => s.bodyweight != null)?.bodyweight

  function startEmpty() {
    const session: Session = { id: uid('s'), date: todayISO(), entries: [], bodyweight: null, notes: '' }
    dispatch({ type: 'START_DRAFT', session })
    onStart()
  }

  return (
    <div className="content">
      {myDraft ? (
        <div className="banner">
          <div>
            <div style={{ fontWeight: 700 }}>Workout in progress</div>
            <div className="hint">{myDraft.entries.length} exercises · started {fmtDate(myDraft.date)}</div>
          </div>
          <button className="btn primary sm" onClick={onStart}>Resume</button>
        </div>
      ) : (
        <>
          <button className="hero-start" onClick={onChooseRoutine}>
            <span className="lead">Start workout</span>
            <span className="tail"><IconPlus size={22} /></span>
          </button>
          <button className="btn ghost sm" onClick={startEmpty} style={{ alignSelf: 'center' }}>or start empty</button>
        </>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="label">Sessions</div>
          <div className="big">{mySessions.length}</div>
          <div className="meta">{activeProfile.name}</div>
        </div>
        <div className="stat">
          <div className="label">Body weight</div>
          <div className="big">{lastBw != null ? lastBw : '—'}</div>
          <div className="meta">most recent</div>
        </div>
      </div>

      <div className="section-title">Recent sessions</div>
      {recent.length === 0 ? (
        <EmptyState icon={<IconDumbbell size={26} />} title="No workouts yet" sub="Tap Start workout to log your first session." />
      ) : (
        <div className="list">
          {recent.map((s) => {
            const names = s.entries
              .map((e) => exerciseById(e.exerciseId)?.name)
              .filter(Boolean)
              .slice(0, 3)
              .join(', ')
            const extra = s.entries.length > 3 ? ` +${s.entries.length - 3}` : ''
            return (
              <button key={s.id} className="list-item" onClick={() => onOpenSession(s.id)}>
                <div style={{ minWidth: 0 }}>
                  <div className="li-title">{fmtDate(s.date)}</div>
                  <div className="li-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {names ? names + extra : 'Body weight only'}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="pill accent">{s.entries.length} ex</span>
                  <span className="chev"><IconChevron size={17} /></span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SessionDetail({ id, onBack }: { id: ID; onBack: () => void }) {
  const { mySessions, exerciseById, dispatch } = useApp()
  const s = mySessions.find((x) => x.id === id)
  if (!s) return <div className="content"><EmptyState icon={<IconHistory size={26} />} title="Session not found" /></div>
  return (
    <div className="content">
      <button className="btn sm ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}><IconArrowLeft size={17} /> Back</button>
      <h2 style={{ margin: '4px 0' }}>{fmtDate(s.date)}</h2>
      {s.bodyweight != null && <div className="pill">Body weight {s.bodyweight}</div>}
      {s.notes && <div className="card tight hint">{s.notes}</div>}
      <div className="list">
        {s.entries.map((e, i) => (
          <div className="card tight" key={i}>
            <div className="li-title">{exerciseById(e.exerciseId)?.name ?? 'Unknown'}</div>
            <div className="li-sub">{summarizeSets(e.sets)}</div>
          </div>
        ))}
      </div>
      <button
        className="btn ghost danger"
        onClick={() => { if (confirm('Delete this session?')) { dispatch({ type: 'DELETE_SESSION', id: s.id }); onBack() } }}
      >
        Delete session
      </button>
    </div>
  )
}
