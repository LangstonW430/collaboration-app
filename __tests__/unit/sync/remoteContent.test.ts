import { describe, it, expect } from 'vitest'
import { shouldApplyRemoteUpdate, clampSelection } from '@/lib/sync/remoteContent'
import type { SyncState } from '@/lib/types/sync'

const base = {
  syncState: 'synced' as SyncState,
  hasQueuedSave: false,
  incoming: '<p>from another collaborator</p>',
  current: '<p>what the editor shows</p>',
}

describe('shouldApplyRemoteUpdate', () => {
  it('applies a remote change when the editor has nothing unsaved', () => {
    expect(shouldApplyRemoteUpdate(base)).toBe(true)
  })

  it('ignores an update identical to what the editor already shows', () => {
    expect(shouldApplyRemoteUpdate({ ...base, incoming: base.current })).toBe(false)
  })

  it.each<SyncState>(['pending', 'conflict', 'error'])(
    'never overwrites unsaved work in the %s state',
    (syncState) => {
      expect(shouldApplyRemoteUpdate({ ...base, syncState })).toBe(false)
    }
  )

  it('never overwrites while a save is still queued', () => {
    // The sync state can read "synced" for the moment between an edit being
    // queued and the manager being told about it.
    expect(shouldApplyRemoteUpdate({ ...base, hasQueuedSave: true })).toBe(false)
  })

  it('applies an update that clears the document', () => {
    expect(shouldApplyRemoteUpdate({ ...base, incoming: '' })).toBe(true)
  })
})

describe('clampSelection', () => {
  it('leaves a selection that still fits alone', () => {
    expect(clampSelection(4, 9, 100)).toEqual({ from: 4, to: 9 })
  })

  it('pulls a selection past the end back to the end', () => {
    expect(clampSelection(80, 95, 20)).toEqual({ from: 20, to: 20 })
  })

  it('clamps only the end when the document shrank between the two', () => {
    expect(clampSelection(5, 40, 12)).toEqual({ from: 5, to: 12 })
  })

  it('never returns a reversed range', () => {
    const { from, to } = clampSelection(30, 2, 50)
    expect(to).toBeGreaterThanOrEqual(from)
  })

  it('handles an empty document', () => {
    expect(clampSelection(7, 9, 0)).toEqual({ from: 0, to: 0 })
  })
})
