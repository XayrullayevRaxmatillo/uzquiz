import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, setCsrfToken } from '../lib/api'
import type { User } from '../lib/types'
import { useI18n } from '../i18n'

interface RegisterInput {
  name: string
  username: string
  email: string
  password: string
  preferredLanguage: 'uz' | 'ru' | 'en'
  avatar?: string
}

interface AuthValue {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  updateUser: (u: User) => void
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { setLang } = useI18n()

  const refresh = useCallback(async () => {
    try {
      const u = await api<{ user: User; csrfToken: string }>('/auth/me')
      setCsrfToken(u.csrfToken)
      setUser(u.user)
      setLang(u.user.preferredLanguage)
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'UNAUTHENTICATED') {
        /* network errors leave the user logged out in the UI */
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (identifier: string, password: string) => {
    const r = await api<{ user: User; csrfToken: string }>('/auth/login', { method: 'POST', body: { identifier, password } })
    setCsrfToken(r.csrfToken)
    setUser(r.user)
    setLang(r.user.preferredLanguage)
    return r.user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const r = await api<{ user: User; csrfToken: string }>('/auth/register', { method: 'POST', body: input })
    setCsrfToken(r.csrfToken)
    setUser(r.user)
    return r.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      setCsrfToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, updateUser: setUser }),
    [user, loading, login, register, logout, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>')
  return c
}
