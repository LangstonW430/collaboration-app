import type { DocumentVersion, ConflictResolution } from '@/lib/types/sync'

export class ConflictResolver {
  resolve(local: DocumentVersion, remote: DocumentVersion): ConflictResolution {
    // Last-write-wins: whichever has the higher serverTimestamp wins.
    // Ties go to remote (the server is authoritative).
    const winner = local.serverTimestamp > remote.serverTimestamp ? 'local' : 'remote'
    const resolvedVersion = winner === 'local' ? local : remote

    this._logResolution(local, remote, winner)

    return {
      strategy: 'last-write-wins',
      winner,
      resolvedVersion,
    }
  }

  detectConflict(local: DocumentVersion, serverTimestamp: number): boolean {
    // A conflict exists when the server has advanced past what we last saw
    // while we still have unsaved local changes.
    return local.hasPendingChanges && serverTimestamp > local.serverTimestamp
  }

  private _logResolution(
    local: DocumentVersion,
    remote: DocumentVersion,
    winner: 'local' | 'remote'
  ): void {
    console.info(
      JSON.stringify({
        type: 'conflict_resolved',
        strategy: 'last-write-wins',
        winner,
        documentId: local.documentId,
        localTimestamp: local.serverTimestamp,
        remoteTimestamp: remote.serverTimestamp,
        timestamp: Date.now(),
      })
    )
  }
}
