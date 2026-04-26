import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConflictResolver } from '@/lib/sync/conflictResolver'
import type { DocumentVersion } from '@/lib/types/sync'

function makeVersion(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    documentId: 'doc-1',
    localSequence: 0,
    serverTimestamp: 1000,
    vectorClock: {},
    hasPendingChanges: false,
    ...overrides,
  }
}

describe('ConflictResolver', () => {
  let resolver: ConflictResolver
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resolver = new ConflictResolver()
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  // --- resolve() ---

  describe('resolve()', () => {
    it('picks local when local timestamp is strictly newer', () => {
      const local = makeVersion({ serverTimestamp: 2000 })
      const remote = makeVersion({ serverTimestamp: 1000 })

      const result = resolver.resolve(local, remote)

      expect(result.strategy).toBe('last-write-wins')
      expect(result.winner).toBe('local')
      expect(result.resolvedVersion).toBe(local)
    })

    it('picks remote when remote timestamp is strictly newer', () => {
      const local = makeVersion({ serverTimestamp: 1000 })
      const remote = makeVersion({ serverTimestamp: 2000 })

      const result = resolver.resolve(local, remote)

      expect(result.winner).toBe('remote')
      expect(result.resolvedVersion).toBe(remote)
    })

    it('picks remote on a timestamp tie (server is authoritative)', () => {
      const ts = 1500
      const local = makeVersion({ serverTimestamp: ts })
      const remote = makeVersion({ serverTimestamp: ts })

      const result = resolver.resolve(local, remote)

      expect(result.winner).toBe('remote')
      expect(result.resolvedVersion).toBe(remote)
    })

    it('logs the resolution as JSON', () => {
      const local = makeVersion({ serverTimestamp: 3000 })
      const remote = makeVersion({ serverTimestamp: 1000 })

      resolver.resolve(local, remote)

      expect(consoleSpy).toHaveBeenCalledOnce()
      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string)
      expect(logged.type).toBe('conflict_resolved')
      expect(logged.strategy).toBe('last-write-wins')
      expect(logged.winner).toBe('local')
      expect(logged.documentId).toBe('doc-1')
      expect(logged.localTimestamp).toBe(3000)
      expect(logged.remoteTimestamp).toBe(1000)
    })

    it('returns the full ConflictResolution shape', () => {
      const local = makeVersion({ serverTimestamp: 500 })
      const remote = makeVersion({ serverTimestamp: 900 })

      const result = resolver.resolve(local, remote)

      expect(result).toHaveProperty('strategy')
      expect(result).toHaveProperty('winner')
      expect(result).toHaveProperty('resolvedVersion')
    })
  })

  // --- detectConflict() ---

  describe('detectConflict()', () => {
    it('returns true when server advanced and local has pending changes', () => {
      const local = makeVersion({ serverTimestamp: 1000, hasPendingChanges: true })

      expect(resolver.detectConflict(local, 2000)).toBe(true)
    })

    it('returns false when local has no pending changes', () => {
      const local = makeVersion({ serverTimestamp: 1000, hasPendingChanges: false })

      expect(resolver.detectConflict(local, 2000)).toBe(false)
    })

    it('returns false when server timestamp has not advanced', () => {
      const local = makeVersion({ serverTimestamp: 2000, hasPendingChanges: true })

      expect(resolver.detectConflict(local, 2000)).toBe(false)
    })

    it('returns false when server timestamp is behind local', () => {
      const local = makeVersion({ serverTimestamp: 3000, hasPendingChanges: true })

      expect(resolver.detectConflict(local, 1000)).toBe(false)
    })

    it('returns true only when both conditions are met', () => {
      const local = makeVersion({ serverTimestamp: 1000, hasPendingChanges: true })

      // Exactly equal — not strictly greater, so no conflict
      expect(resolver.detectConflict(local, 1000)).toBe(false)
      // One millisecond ahead — conflict
      expect(resolver.detectConflict(local, 1001)).toBe(true)
    })
  })
})
