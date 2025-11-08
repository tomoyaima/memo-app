export type AuthSession = {
  provider: 'cognito'
  userId: string
  username: string
  accessToken: string
  idToken: string
  refreshToken?: string
  issuedAt: number
}

const STORAGE_KEY = 'notes-auth-session'
type Listener = (session: AuthSession | null) => void

const listeners = new Set<Listener>()

const readFromStorage = (): AuthSession | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

let currentSession: AuthSession | null = typeof window === 'undefined' ? null : readFromStorage()

const persist = (session: AuthSession | null) => {
  if (typeof window === 'undefined') return
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export const getCurrentSession = () => currentSession

export const setAuthSession = (session: AuthSession | null) => {
  currentSession = session
  persist(session)
  listeners.forEach((listener) => listener(currentSession))
}

export const clearAuthSession = () => setAuthSession(null)

export const subscribeAuthSession = (listener: Listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
