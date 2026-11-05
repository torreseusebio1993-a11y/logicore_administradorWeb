import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, SESSION_EXPIRED, tokenStore } from '../api/client'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  checking: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider ({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(Boolean(tokenStore.get()))

  // Al abrir: si hay token guardado, verificar que la sesión siga viva
  useEffect(() => {
    if (!tokenStore.get()) return
    api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setChecking(false))
  }, [])

  // Sesión vencida en cualquier petición → volver al login
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(SESSION_EXPIRED, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.login(username, password)
    tokenStore.set(r.token)
    setUser(r.user)
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* la sesión ya no existe */ }
    tokenStore.clear()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth () {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
