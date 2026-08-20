'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
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

  // Memoised: a fresh object here re-renders every consumer — which includes
  // the editor — on each render of this provider.
  const value = useMemo(
    () => ({ state, isOnline, isAuthenticated, isAuthLoading }),
    [state, isOnline, isAuthenticated, isAuthLoading]
  )

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionContext)
}
