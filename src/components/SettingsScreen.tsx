import { useRef, useState } from 'react'
import { useApp, buildInitial, STORAGE_KEY } from '../lib/store'
import { sheetUrl } from '../lib/sheetsSync'
import type { AppState, Exercise, Session } from '../lib/types'

export function SettingsScreen() {
  const { state, dispatch, activeProfile, sync, signInAndSync, syncNow, signOut, connectSheet, importHistory } = useApp()
  const [newProfile, setNewProfile] = useState('')
  const [connectVal, setConnectVal] = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const backupRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLInputElement>(null)

  const currentSheetId = state.sheetIds[activeProfile.id]

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importBackup(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState
        if (!parsed.profiles || !parsed.exercises) throw new Error('bad file')
        if (!confirm('Replace ALL current data with this backup?')) return
        dispatch({ type: 'REPLACE_STATE', state: parsed })
        alert('Backup restored.')
      } catch {
        alert('That file is not a valid full backup.')
      }
    }
    reader.readAsText(file)
  }

  function importHistoryFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { exercises: Exercise[]; sessions: Session[] }
        if (!Array.isArray(parsed.exercises) || !Array.isArray(parsed.sessions)) throw new Error('bad')
        importHistory(parsed)
        alert(`Imported ${parsed.exercises.length} exercises and ${parsed.sessions.length} sessions. Sign in & sync to save it to your Google Sheet.`)
      } catch {
        alert('That file is not a valid training-history export.')
      }
    }
    reader.readAsText(file)
  }

  function resetAll() {
    if (!confirm('Reset EVERYTHING to the empty starting state? This erases local data (your Google Sheet is untouched).')) return
    localStorage.removeItem(STORAGE_KEY)
    dispatch({ type: 'REPLACE_STATE', state: buildInitial() })
  }

  return (
    <div className="content">
      {/* ---- Google sync ---- */}
      <div className="section-title">Cloud backup & sync</div>
      {!sync.configured ? (
        <div className="card tight hint">Google sign-in isn't configured in this build.</div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row between">
            <div>
              <div className="li-title">{sync.signedIn ? 'Signed in to Google' : 'Not signed in'}</div>
              <div className="li-sub">
                {sync.syncing
                  ? 'Syncing…'
                  : sync.lastSyncAt
                    ? `Last synced ${new Date(sync.lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : 'Your data stays private in your own Google Sheet.'}
              </div>
            </div>
            <span className="dot" style={{ width: 10, height: 10, background: sync.signedIn ? 'var(--good)' : 'var(--faint)' }} />
          </div>

          {sync.error && <div className="hint" style={{ color: 'var(--danger)' }}>{sync.error}</div>}

          {sync.signedIn ? (
            <div className="row">
              <button className="btn primary grow" onClick={() => syncNow()} disabled={sync.syncing}>
                {sync.syncing ? 'Syncing…' : '⟳ Sync now'}
              </button>
              <button className="btn ghost" onClick={signOut} disabled={sync.syncing}>Sign out</button>
            </div>
          ) : (
            <button className="btn primary big" onClick={() => signInAndSync().catch(() => {})} disabled={sync.syncing}>
              Sign in with Google & sync
            </button>
          )}

          {currentSheetId && (
            <a className="hint" href={sheetUrl(currentSheetId)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-2)' }}>
              Open my workout sheet ↗
            </a>
          )}

          <button className="btn sm ghost" onClick={() => setShowConnect((v) => !v)}>
            {showConnect ? 'Cancel' : 'Connect an existing sheet (another device)'}
          </button>
          {showConnect && (
            <div className="row">
              <input
                className="search grow"
                placeholder="Paste your sheet URL…"
                value={connectVal}
                onChange={(e) => setConnectVal(e.target.value)}
              />
              <button
                className="btn"
                onClick={() => { connectSheet(connectVal); setConnectVal(''); setShowConnect(false) }}
              >Link</button>
            </div>
          )}
          <div className="hint">
            Data is stored on this device and works offline. Signing in backs it up to a private
            Google Sheet in <b>your</b> account and pulls it to any device you sign in on.
          </div>
        </div>
      )}

      {/* ---- Import starter history ---- */}
      <div className="section-title">Import training history</div>
      <div className="hint">
        One-time: load a training-history file (e.g. your exported spreadsheet history) to seed your
        records. Do this once on your computer, then <b>Sign in &amp; sync</b> — it'll be on your phone
        after you sign in there.
      </div>
      <button className="btn" onClick={() => historyRef.current?.click()}>⬆ Import training history file</button>
      <input ref={historyRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importHistoryFile(f); e.target.value = '' }} />

      {/* ---- Profiles ---- */}
      <div className="section-title">Profiles</div>
      <div className="list">
        {state.profiles.map((p) => (
          <button key={p.id} className="list-item" onClick={() => dispatch({ type: 'SET_PROFILE', id: p.id })}>
            <div className="li-title">{p.name}</div>
            {p.id === activeProfile.id ? <span className="pill accent">active</span> : <span className="pill">{(state.sessions[p.id] || []).length} sessions</span>}
          </button>
        ))}
      </div>
      <div className="row">
        <input className="search grow" placeholder="Add a person…" value={newProfile} onChange={(e) => setNewProfile(e.target.value)} />
        <button className="btn primary" disabled={!newProfile.trim()} onClick={() => { dispatch({ type: 'ADD_PROFILE', name: newProfile }); setNewProfile('') }}>Add</button>
      </div>

      {/* ---- Local backup ---- */}
      <div className="section-title">Local backup file</div>
      <div className="row">
        <button className="btn grow" onClick={exportData}>⬇ Export</button>
        <button className="btn grow" onClick={() => backupRef.current?.click()}>⬆ Restore</button>
        <input ref={backupRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = '' }} />
      </div>

      <div className="section-title">Danger zone</div>
      <button className="btn danger" onClick={resetAll}>Reset local data</button>

      <div style={{ height: 12 }} />
      <div className="hint" style={{ textAlign: 'center' }}>
        Workout Tracker · offline-first, private cloud sync via your Google account.<br />
        Add to Home Screen for a full-screen app.
      </div>
    </div>
  )
}
