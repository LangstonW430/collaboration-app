'use client'

import { useEffect } from 'react'
import { useQuery } from 'convex/react'
import type { Id } from '@/convex/_generated/dataModel'
import type { PresenceUser } from '@/lib/services/types'
import { presenceQueries } from '@/lib/services'
import { useDocumentService } from './useDocumentService'

// Client-side mirror of convex/presence.ts HEARTBEAT_INTERVAL_MS. Kept as a
// literal because importing server code into the client bundle drags the whole
// Convex module graph with it.
const HEARTBEAT_INTERVAL_MS = 10_000

/**
 * Announces that the current user is viewing `docId` and returns the other
 * people viewing it right now. Heartbeats stop when the component unmounts;
 * the server ages the row out shortly after.
 */
export function usePresence(docId: Id<'documents'>): PresenceUser[] {
  const { heartbeat } = useDocumentService()

  useEffect(() => {
    // Failures are ignored: presence is decoration, and the next beat retries.
    const beat = () => { void heartbeat(docId).catch(() => {}) }
    beat()
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [docId, heartbeat])

  return useQuery(presenceQueries.activeUsers, { docId }) ?? []
}
