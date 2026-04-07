import { createContext, useContext, useEffect, useState } from 'react'
import { authApi, ApiError } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  setUser: () => {},
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function useAuthState(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then(u => {
        setUser(u)
      })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) {
          setUser(null)
        }
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    setUser(null)
    window.location.href = '/login'
  }

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    logout,
    setUser,
  }
}
