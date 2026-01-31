'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from './types'
import { getCurrentUserId, setCurrentUserId, getUsers } from './storage'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (userId: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const userId = getCurrentUserId()
    if (userId) {
      const users = getUsers()
      const foundUser = users.find((u) => u.id === userId)
      setUser(foundUser || null)
    }
    setIsLoading(false)
  }, [])

  const login = (userId: string) => {
    setCurrentUserId(userId)
    const users = getUsers()
    const foundUser = users.find((u) => u.id === userId)
    setUser(foundUser || null)
  }

  const logout = () => {
    setCurrentUserId(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
