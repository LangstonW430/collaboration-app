import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncManager } from '@/lib/sync/syncManager'

function makeManager(ts = 1000) {
  return new SyncManager('doc-1', ts)
}

describe('SyncManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // --- initial state ---

  it('starts in "synced" state', () => {
    const m = makeManager()
    expect(m.getState()).toBe('synced')
  })

  // --- subscribe / unsubscribe ---

  it('notifies subscribers on state change', () => {
    const m = makeManager()
    const cb = vi.fn()
    m.start()
    m.subscribe(cb)
    m.onLocalChange()
    expect(cb).toHaveBeenCalledWith('pending')
  })

  it('unsubscribe stops notifications', () => {
    const m = makeManager()
    const cb = vi.fn()
    m.start()
    const unsub = m.subscribe(cb)
    unsub()
    m.onLocalChange()
    expect(cb).not.toHaveBeenCalled()
  })

  it('stop() clears all subscribers and timers', () => {
    const m = makeManager()
    const cb = vi.fn()
    m.start()
    m.subscribe(cb)
    m.stop()
    m.onLocalChange() // would notify if subscriber still registered
    expect(cb).not.toHaveBeenCalled()
  })

  // --- onLocalChange ---

  it('transitions synced → pending on local change', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()
    expect(m.getState()).toBe('pending')
  })

  it('increments localSequence on each local change', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()
    m.onLocalChange()
    expect(m.getVersion().localSequence).toBe(2)
  })

  it('marks hasPendingChanges on local change', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()
    expect(m.getVersion().hasPendingChanges).toBe(true)
  })

  // --- onSaveSuccess ---

  it('transitions pending → synced on save success', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()
    m.onSaveSuccess(2000)
    expect(m.getState()).toBe('synced')
  })

  it('clears hasPendingChanges on save success', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()
    m.onSaveSuccess(2000)
    expect(m.getVersion().hasPendingChanges).toBe(false)
  })

  it('updates serverTimestamp on save success', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()
    m.onSaveSuccess(9999)
    expect(m.getVersion().serverTimestamp).toBe(9999)
  })

  // --- onSaveFailure / retry ---

  it('transitions to error immediately on failure, then back to pending after backoff', () => {
    const cb = vi.fn()
    const m = makeManager()
    m.start()
    m.subscribe(cb)
    m.onLocalChange()

    m.onSaveFailure(new Error('oops'))
    expect(m.getState()).toBe('error')

    vi.advanceTimersByTime(1000) // base backoff: 1s * 2^0 = 1s
    expect(m.getState()).toBe('pending')
    expect(cb).toHaveBeenCalledWith('pending')
  })

  it('transitions to error after MAX_RETRIES (3) failures', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()

    m.onSaveFailure(new Error('1'))
    vi.advanceTimersByTime(1000)
    m.onSaveFailure(new Error('2'))
    vi.advanceTimersByTime(2000)
    m.onSaveFailure(new Error('3'))
    vi.advanceTimersByTime(4000)
    m.onSaveFailure(new Error('4'))

    expect(m.getState()).toBe('error')
  })

  it('resets retry count on save success', () => {
    const m = makeManager()
    m.start()
    m.onLocalChange()

    // Fail once, then recover
    m.onSaveFailure(new Error('fail'))
    expect(m.getState()).toBe('error')
    vi.advanceTimersByTime(1000) // retry fires → pending
    m.onSaveSuccess(2000)
    expect(m.getState()).toBe('synced')

    // Retry count reset — first failure after recovery should go to error (not permanently error)
    m.onLocalChange()
    m.onSaveFailure(new Error('fail2'))
    expect(m.getState()).toBe('error') // transitions to error before retry backoff
    vi.advanceTimersByTime(1000)
    expect(m.getState()).toBe('pending') // retry fires, back to pending
  })

  // --- onServerUpdate ---

  it('silently advances serverTimestamp when no pending changes', () => {
    const m = makeManager(1000)
    m.start()
    m.onServerUpdate(2000)
    expect(m.getState()).toBe('synced')
    expect(m.getVersion().serverTimestamp).toBe(2000)
  })

  it('detects conflict when pending and server advances', () => {
    const m = makeManager(1000)
    m.start()
    m.onLocalChange()          // hasPendingChanges = true
    m.onServerUpdate(2000)     // server advanced
    expect(m.getState()).toBe('conflict')
  })

  it('suppresses own-save echo via _savedJustNow flag', () => {
    const m = makeManager(1000)
    m.start()
    m.onLocalChange()
    m.onSaveSuccess(2000)      // sets _savedJustNow = true

    // Immediately after save success, reactive query fires with same timestamp
    m.onServerUpdate(2000)
    expect(m.getState()).toBe('synced') // no conflict

    // After the setTimeout(0) clears the flag, a real other-user update would conflict
    vi.runAllTimers()
    // State should remain synced with no pending changes
    m.onServerUpdate(3000)
    expect(m.getState()).toBe('synced') // hasPendingChanges=false so no conflict
  })

  // --- acknowledgeConflict ---

  it('transitions conflict → synced on acknowledge', () => {
    const m = makeManager(1000)
    m.start()
    m.onLocalChange()
    m.onServerUpdate(2000)
    expect(m.getState()).toBe('conflict')

    m.acknowledgeConflict()
    expect(m.getState()).toBe('synced')
  })

  it('clears hasPendingChanges on acknowledge', () => {
    const m = makeManager(1000)
    m.start()
    m.onLocalChange()
    m.onServerUpdate(2000)
    m.acknowledgeConflict()
    expect(m.getVersion().hasPendingChanges).toBe(false)
  })

  // --- onSaveAttempt ---

  it('emits save_started event', () => {
    const spy = vi.spyOn(console, 'info')
    const m = makeManager()
    m.start()
    m.onSaveAttempt()

    const calls = spy.mock.calls.map((c) => {
      try { return JSON.parse(c[0] as string) } catch { return null }
    }).filter(Boolean)
    expect(calls.some((e) => e.type === 'save_started')).toBe(true)
  })
})
