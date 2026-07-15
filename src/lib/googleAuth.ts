// Client-side Google auth via Google Identity Services (GIS) token client.
// No client secret — implicit token popup flow, appropriate for a static SPA
// with no backend. Ported from the LifeFlow app; reuses the same OAuth client.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
// `spreadsheets` lets us create + read + write the user's Workout sheet.
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'
const STORAGE_KEY = 'workout.googleToken'

interface TokenRecord {
  accessToken: string
  expiresAt: number
}

// Minimal shape of the GIS oauth2 namespace we use.
interface Gis {
  initTokenClient(cfg: {
    client_id: string
    scope: string
    callback: (r: { access_token?: string; expires_in?: number; error?: string; error_description?: string }) => void
  }): { requestAccessToken(opts?: { prompt?: string }): void; callback: unknown; error_callback: unknown }
  revoke(token: string, done: () => void): void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: Gis } }
  }
}

let tokenClient: ReturnType<Gis['initTokenClient']> | null = null
let gisReady: Promise<Gis> | null = null

export function isConfigured(): boolean {
  return !!CLIENT_ID
}

function waitForGis(): Promise<Gis> {
  if (gisReady) return gisReady
  gisReady = new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const oauth2 = window.google?.accounts?.oauth2
      if (oauth2) resolve(oauth2)
      else if (Date.now() - start > 10000)
        reject(new Error('Google sign-in failed to load. Check your connection and reload.'))
      else setTimeout(check, 100)
    }
    check()
  })
  return gisReady
}

function readStoredToken(): TokenRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TokenRecord
    if (!parsed.accessToken || !parsed.expiresAt) return null
    if (Date.now() >= parsed.expiresAt - 60_000) return null
    return parsed
  } catch {
    return null
  }
}

function storeToken(accessToken: string, expiresInSeconds: number): TokenRecord {
  const record: TokenRecord = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  return record
}

export function getValidAccessToken(): string | null {
  return readStoredToken()?.accessToken ?? null
}

export function isSignedIn(): boolean {
  return !!getValidAccessToken()
}

export async function ensureAccessToken({ interactive = true } = {}): Promise<string> {
  const cached = getValidAccessToken()
  if (cached) return cached
  if (!CLIENT_ID) throw new Error('Google sign-in is not configured for this build.')

  const oauth2 = await waitForGis()
  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: () => {} })
  }
  const client = tokenClient
  return new Promise((resolve, reject) => {
    client.callback = (response: { access_token?: string; expires_in?: number; error?: string; error_description?: string }) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error_description || response.error || 'Sign-in failed.'))
        return
      }
      resolve(storeToken(response.access_token, response.expires_in ?? 3600).accessToken)
    }
    ;(client as unknown as { error_callback: (e: { message?: string }) => void }).error_callback = (err) =>
      reject(new Error(err?.message || 'Google sign-in was cancelled or failed.'))
    client.requestAccessToken({ prompt: interactive ? '' : 'none' })
  })
}

export function signOut(): void {
  const token = getValidAccessToken()
  localStorage.removeItem(STORAGE_KEY)
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {})
  }
}
