import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { completeCognitoLogin, startCognitoLogin, startCognitoLogout } from '../auth/cognito'
import {
  clearAuthSession,
  getCurrentSession,
  setAuthSession,
  subscribeAuthSession,
} from '../auth/session'
import type { AuthSession } from '../auth/session'

export type AuthProviderType = 'none' | 'auth0' | 'cognito' | 'supabase'

type AuthContextValue = {
  provider: AuthProviderType
  setProvider: (provider: AuthProviderType) => void
  session: AuthSession | null
  isAuthenticated: boolean
  login: () => Promise<void>
  completeRedirect: (params: { code: string; state?: string }) => Promise<void>
  logout: () => void
  loading: boolean
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const AUTH_PROVIDER_KEY = 'notes-auth-provider'

const getInitialProvider = (): AuthProviderType => {
  if (typeof window === 'undefined') return 'none'
  const stored = window.localStorage.getItem(AUTH_PROVIDER_KEY) as AuthProviderType | null
  return stored ?? (import.meta.env.VITE_AUTH_PROVIDER ?? 'none')
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [provider, setProviderState] = useState<AuthProviderType>(getInitialProvider)
  const [session, setSessionState] = useState<AuthSession | null>(() => getCurrentSession())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeAuthSession(setSessionState), [])

  const setProvider = useCallback((value: AuthProviderType) => {
    setProviderState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_PROVIDER_KEY, value)
    }
    if (value !== 'cognito') {
      clearAuthSession()
    }
  }, [])

  const login = useCallback(async () => {
    if (provider !== 'cognito') {
      throw new Error('Cognito プロバイダーを選択してください')
    }
    try {
      await startCognitoLogin()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cognito リダイレクトに失敗しました'
      setError(message)
      throw err
    }
  }, [provider])

  const completeRedirect = useCallback(
    async ({ code, state }: { code: string; state?: string }) => {
      if (provider !== 'cognito') return
      setLoading(true)
      setError(null)
      try {
        const tokens = await completeCognitoLogin(code, state)
        setAuthSession({
          provider: 'cognito',
          userId: tokens.userId,
          username: tokens.username,
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          refreshToken: tokens.refreshToken,
          issuedAt: Date.now(),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Cognito 認証の完了に失敗しました'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [provider],
  )

  const logout = useCallback(() => {
    clearAuthSession()
    if (provider === 'cognito') {
      startCognitoLogout()
    }
  }, [provider])

  const value = useMemo<AuthContextValue>(
    () => ({
      provider,
      setProvider,
      session,
      isAuthenticated: Boolean(session),
      login,
      completeRedirect,
      logout,
      loading,
      error,
      clearError: () => setError(null),
    }),
    [provider, session, login, completeRedirect, logout, loading, error, setProvider],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
