import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  beginLogin,
  takeRedirectResult,
  loadToken,
  logout as clearToken,
  type StoredToken,
} from './wcaAuth'
import { fetchMe, isDelegate, WcaApiError } from '../wca/api'
import type { WcaMe } from '../wca/types'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error'

interface AuthState {
  status: AuthStatus
  token: StoredToken | null
  me: WcaMe | null
  /** true se Delegado OU Organizador (gerencia ≥1 competição). */
  canManage: boolean
  isDelegate: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  login: (returnTo?: string) => void
  logout: () => void
  /** Marca acesso liberado após confirmar competições geríveis. */
  setManagesCompetitions: (value: boolean) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    token: null,
    me: null,
    canManage: false,
    isDelegate: false,
    error: null,
  })

  const bootstrap = useCallback(async () => {
    try {
      // 1. Se o token voltou no fragmento da URL (implicit grant), consome.
      const redirect = takeRedirectResult()
      if (redirect.error) throw new Error(redirect.error)
      const token = redirect.token ?? loadToken()

      if (!token) {
        setState((s) => ({ ...s, status: 'anonymous', token: null, me: null }))
        return
      }

      const me = await fetchMe(token.accessToken)
      setState({
        status: 'authenticated',
        token,
        me,
        isDelegate: isDelegate(me),
        canManage: isDelegate(me), // refinado depois ao carregar competições
        error: null,
      })
    } catch (err) {
      if (err instanceof WcaApiError && err.status === 401) {
        clearToken()
        setState((s) => ({ ...s, status: 'anonymous', token: null, me: null, error: null }))
        return
      }
      setState((s) => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Erro desconhecido no login.',
      }))
    }
  }, [])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const login = useCallback((returnTo?: string) => {
    beginLogin(returnTo)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setState({
      status: 'anonymous',
      token: null,
      me: null,
      canManage: false,
      isDelegate: false,
      error: null,
    })
  }, [])

  const setManagesCompetitions = useCallback((value: boolean) => {
    setState((s) => ({ ...s, canManage: s.isDelegate || value }))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, setManagesCompetitions }),
    [state, login, logout, setManagesCompetitions],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
