'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from './types'
import { getUsers } from './api-storage'

const CURRENT_USER_KEY = 'calorie_tracker_current_user'

function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CURRENT_USER_KEY)
}

function setCurrentUserId(userId: string | null): void {
  if (typeof window === 'undefined') return
  if (userId) {
    localStorage.setItem(CURRENT_USER_KEY, userId)
  } else {
    localStorage.removeItem(CURRENT_USER_KEY)
  }
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (userId: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const userId = getCurrentUserId()
      if (userId) {
        try {
          const users = await getUsers()
          const foundUser = users.find((u) => u.id === userId)
          setUser(foundUser || null)
        } catch (error) {
          console.error('[v0] Error loading user:', error)
          setUser(null)
        }
      }
      setIsLoading(false)
    }
    loadUser()
  }, [])

  const login = async (userId: string) => {
    setCurrentUserId(userId)
    try {
      const users = await getUsers()
      const foundUser = users.find((u) => u.id === userId)
      setUser(foundUser || null)
    } catch (error) {
      console.error('[v0] Error during login:', error)
    }
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
