import { useEffect, useRef, useState } from 'react'
import { ConflictResolver } from './conflictResolver'
import type { SyncState, SyncEvent, DocumentVersion } from '@/lib/types/sync'

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

type StateSubscriber = (state: SyncState) => void

export class SyncManager {
  private _state: SyncState = 'synced'
  private _version: DocumentVersion
  private _subscribers: Set<StateSubscriber> = new Set()
  private _retryCount = 0
  private _retryTimer: ReturnType<typeof setTimeout> | null = null
  private _savedJustNow = false
  private _resolver = new ConflictResolver()

  constructor(documentId: string, initialServerTimestamp: number) {
    this._version = {
      documentId,
      localSequence: 0,
      serverTimestamp: initialServerTimestamp,
      vectorClock: {},
      hasPendingChanges: false,
    }
  }

  getState(): SyncState {
    return this._state
  }

  getVersion(): DocumentVersion {
    return { ...this._version }
  }

  subscribe(callback: StateSubscriber): () => void {
    this._subscribers.add(callback)
    return () => this._subscribers.delete(callback)
  }

  start(): void {
    this._setState('synced')
  }

  stop(): void {
    if (this._retryTimer !== null) {
      clearTimeout(this._retryTimer)
      this._retryTimer = null
    }
    this._subscribers.clear()
  }

  onLocalChange(): void {
    this._version = {
      ...this._version,
      localSequence: this._version.localSequence + 1,
      hasPendingChanges: true,
    }
    if (this._state === 'synced' || this._state === 'error') {
      this._setState('pending')
    }
    this._emit({ type: 'state_changed', documentId: this._version.documentId, timestamp: Date.now() })
  }

  onSaveAttempt(): void {
    this._emit({ type: 'save_started', documentId: this._version.documentId, timestamp: Date.now() })
  }

  onSaveSuccess(serverTimestamp: number): void {
    this._savedJustNow = true
    this._retryCount = 0
    this._version = {
      ...this._version,
      serverTimestamp,
      hasPendingChanges: false,
    }
    this._setState('synced')
    this._emit({ type: 'save_succeeded', documentId: this._version.documentId, timestamp: Date.now() })

    // Clear the flag after a tick so onServerUpdate triggered by this save is ignored
    setTimeout(() => { this._savedJustNow = false }, 0)
  }

  onSaveFailure(error: unknown): void {
    this._emit({ type: 'save_failed', documentId: this._version.documentId, timestamp: Date.now(), data: error })

    if (this._retryCount < MAX_RETRIES) {
      this._retryCount++
      const delay = Math.min(BASE_BACKOFF_MS * Math.pow(2, this._retryCount - 1), MAX_BACKOFF_MS)
      // Transition to error so subscribers see the failure, then back to pending when backoff expires
      this._setState('error')
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null
        this._setState('pending')
      }, delay)
    } else {
      this._retryCount = 0
      this._setState('error')
    }
  }

  onServerUpdate(serverTimestamp: number): void {
    if (this._savedJustNow) return

    if (this._resolver.detectConflict(this._version, serverTimestamp)) {
      this._emit({ type: 'conflict_detected', documentId: this._version.documentId, timestamp: Date.now(), data: { serverTimestamp } })
      this._setState('conflict')
      return
    }

    // No pending changes — silently advance our known server timestamp
    this._version = { ...this._version, serverTimestamp }
  }

  acknowledgeConflict(): void {
    // Called when the user chooses to reload remote changes
    this._version = { ...this._version, hasPendingChanges: false }
    this._emit({ type: 'conflict_resolved', documentId: this._version.documentId, timestamp: Date.now() })
    this._setState('synced')
  }

  private _setState(next: SyncState): void {
    if (this._state === next) return
    this._state = next
    this._subscribers.forEach((cb) => cb(next))
  }

  private _emit(event: SyncEvent): void {
    console.info(JSON.stringify(event))
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useSyncManager(documentId: string, serverTimestamp: number) {
  const managerRef = useRef<SyncManager | null>(null)

  if (managerRef.current === null) {
    managerRef.current = new SyncManager(documentId, serverTimestamp)
  }

  const [syncState, setSyncState] = useState<SyncState>(() => managerRef.current!.getState())

  useEffect(() => {
    const manager = managerRef.current!
    manager.start()
    const unsub = manager.subscribe(setSyncState)
    return () => {
      unsub()
      manager.stop()
    }
  }, [])

  // When the server timestamp advances (Convex reactive query update), inform the manager
  useEffect(() => {
    managerRef.current?.onServerUpdate(serverTimestamp)
  }, [serverTimestamp])

  return {
    syncState,
    manager: managerRef.current,
  }
}
