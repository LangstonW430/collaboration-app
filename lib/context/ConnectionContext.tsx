'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useConvexAuth } from 'convex/react'

export type ConnectionState = 'loading' | 'connected' | 'disconnected' | 'auth_expired'

export interface ConnectionStatus {
  state: ConnectionState
  isOnline: boolean
  isAuthenticated: boolean
  isAuthLoading: boolean
}

const ConnectionContext = createContext<ConnectionStatus>({
  state: 'loading',
  isOnline: true,
  isAuthenticated: false,
  isAuthLoading: true,
})

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth()

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const state: ConnectionState = isAuthLoading
    ? 'loading'
    : !isOnline
    ? 'disconnected'
    : !isAuthenticated
    ? 'auth_expired'
    : 'connected'

  return (
    <ConnectionContext.Provider value={{ state, isOnline, isAuthenticated, isAuthLoading }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionContext)
}
