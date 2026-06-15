import { createContext, useCallback, useContext, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Rehydrate from localStorage on first load
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('vni_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    // POST /api/v1/auth/login → { accessToken, tokenType, expiresIn, user }
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('vni_token', data.accessToken)
    localStorage.setItem('vni_user',  JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('vni_token')
    localStorage.removeItem('vni_user')
    setUser(null)
  }, [])

  /**
   * hasRole('admin') or hasRole('rep', 'manager')
   * Returns true if the current user's role matches any of the given values.
   */
  const hasRole = useCallback(
    (...roles) => (user ? roles.includes(user.role) : false),
    [user]
  )

  return (
    <AuthContext.Provider
      value={{ user, login, logout, hasRole, isAuthenticated: Boolean(user) }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
