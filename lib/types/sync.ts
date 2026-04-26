export type SyncState = 'synced' | 'pending' | 'conflict' | 'error'

export interface DocumentVersion {
  documentId: string
  localSequence: number
  serverTimestamp: number
  vectorClock: Record<string, number>
  hasPendingChanges: boolean
}

export interface ConflictResolution {
  strategy: 'last-write-wins'
  winner: 'local' | 'remote'
  resolvedVersion: DocumentVersion
}

export type SyncEventType =
  | 'save_started'
  | 'save_succeeded'
  | 'save_failed'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'state_changed'

export interface SyncEvent {
  type: SyncEventType
  documentId: string
  timestamp: number
  data?: unknown
}
