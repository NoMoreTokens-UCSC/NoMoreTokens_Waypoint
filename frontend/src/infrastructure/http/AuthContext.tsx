/**
 * AuthContext — JWT session state for the real backend.
 *
 * Components call `useAuth()` to get the current user and login/logout.
 * When the API URL is not configured, this is a no-op and the local
 * session (useSession) drives everything as before.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { login as apiLogin, logout as apiLogout, getMe, clearToken, getToken } from '../http/apiClient'
import type { ApiUserProfile } from '../http/apiClient'

interface AuthState {
  user: ApiUserProfile | null
  loading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  login(username: string, password: string): Promise<void>
  logout(): void
  isAuthenticated: boolean
  isRealBackend: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isRealBackendConfigured(): boolean {
  return !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isRealBackend = isRealBackendConfigured()

  const [state, setState] = useState<AuthState>({
    user: null,
    loading: isRealBackend && !!getToken(),  // only auto-load if we have a token
    error: null,
  })

  // On mount, restore session from stored token
  useEffect(() => {
    if (!isRealBackend || !getToken()) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    getMe()
      .then((user) => setState({ user, loading: false, error: null }))
      .catch(() => {
        clearToken()
        setState({ user: null, loading: false, error: null })
      })
  }, [isRealBackend])

  const login = useCallback(async (username: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const resp = await apiLogin(username, password)
      setState({ user: resp.user, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setState({ user: null, loading: false, error: message })
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setState({ user: null, loading: false, error: null })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        isAuthenticated: !!state.user,
        isRealBackend,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
