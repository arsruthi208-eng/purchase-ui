import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface AuthUser {
  token: string
  role: string
  fullName: string
  profilePicture?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  login: (token: string, role: string, fullName: string, profilePicture?: string | null) => void
  logout: () => void
  updatePicture: (pic: string | null) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
  updatePicture: () => {},
  isAuthenticated: false,
})

const STORAGE_KEY = 'au_auth'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return null }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return Date.now() >= payload.exp * 1000
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null
      const parsed: AuthUser = JSON.parse(stored)
      if (isTokenExpired(parsed.token)) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
      return parsed
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
  })

  const persist = (u: AuthUser) => {
    // Store everything except the profile picture in localStorage (may be large)
    // The picture itself is kept in memory and in a separate smaller key
    const { profilePicture, ...small } = u
    localStorage.setItem(STORAGE_KEY, JSON.stringify(small))
    // Profile picture stored separately (survives page reload)
    if (profilePicture) {
      localStorage.setItem('au_avatar', profilePicture)
    } else {
      localStorage.removeItem('au_avatar')
    }
  }

  const login = useCallback((token: string, role: string, fullName: string, profilePicture?: string | null) => {
    const pic = profilePicture ?? localStorage.getItem('au_avatar') ?? null
    const authUser: AuthUser = { token, role, fullName, profilePicture: pic }
    persist(authUser)
    setUser(authUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('au_avatar')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const updatePicture = useCallback((pic: string | null) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, profilePicture: pic }
      persist(updated)
      return updated
    })
  }, [])

  // Restore picture from separate key on first load
  useEffect(() => {
    if (user && !user.profilePicture) {
      const saved = localStorage.getItem('au_avatar')
      if (saved) setUser(prev => prev ? { ...prev, profilePicture: saved } : prev)
    }
  }, []) // eslint-disable-line

  // Check token expiry every 60s
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      if (isTokenExpired(user.token)) logout()
    }, 60_000)
    return () => clearInterval(interval)
  }, [user, logout])

  return (
    <AuthContext.Provider value={{ user, login, logout, updatePicture, isAuthenticated: user !== null }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
