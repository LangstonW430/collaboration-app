import type { SyncState } from '@/lib/types/sync'

export interface RemoteUpdate {
  /** The editor's current sync state. */
  syncState: SyncState
  /** True when an edit is waiting to be written to the server. */
  hasQueuedSave: boolean
  /** The value pushed from the server. */
  incoming: string
  /** The value the editor is showing right now. */
  current: string
}

/**
 * Whether a document update pushed from the server should replace what the
 * editor is currently showing.
 *
 * Convex re-delivers the document to every subscriber whenever it changes, so
 * this runs for remote saves and for the echo of the user's own save alike.
 * Applying an update is destructive — it replaces the editor's contents — so
 * it is allowed only when nothing local would be lost:
 *
 *  - "synced" is the only state in which the editor holds no unsaved work.
 *    "pending" means an edit is in flight, and "conflict"/"error" mean an edit
 *    exists that the server has not accepted; overwriting any of them would
 *    discard the user's typing without asking. A remote save landing during
 *    those states is surfaced as a conflict for the user to resolve instead.
 *  - A queued save is unsaved work even if the state has not caught up yet.
 *  - An identical value is not worth applying, which also filters out the
 *    echo of the user's own save.
 */
export function shouldApplyRemoteUpdate({
  syncState,
  hasQueuedSave,
  incoming,
  current,
}: RemoteUpdate): boolean {
  if (syncState !== 'synced') return false
  if (hasQueuedSave) return false
  return incoming !== current
}

/**
 * Keeps a selection inside a document of `size`, for restoring the caret after
 * remote content replaced what the editor was showing.
 */
export function clampSelection(
  from: number,
  to: number,
  size: number
): { from: number; to: number } {
  const safeFrom = Math.max(0, Math.min(from, size))
  const safeTo = Math.max(safeFrom, Math.min(to, size))
  return { from: safeFrom, to: safeTo }
}
