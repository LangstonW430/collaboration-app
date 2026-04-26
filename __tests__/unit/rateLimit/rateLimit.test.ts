import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, clearRateLimit } from '@/lib/rateLimit'

const KEY = 'test-doc-id'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearRateLimit(KEY)
  })
  afterEach(() => {
    vi.useRealTimers()
    clearRateLimit(KEY)
  })

  it('allows the first call', () => {
    const result = checkRateLimit(KEY)
    expect(result.allowed).toBe(true)
    expect(result.retryAfterMs).toBe(0)
  })

  it('decrements remaining on each allowed call', () => {
    const r1 = checkRateLimit(KEY)
    const r2 = checkRateLimit(KEY)
    expect(r2.remaining).toBe(r1.remaining - 1)
  })

  it('blocks after 10 calls within the window', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(KEY)
    const result = checkRateLimit(KEY)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('allows calls again after the sliding window expires', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(KEY)
    expect(checkRateLimit(KEY).allowed).toBe(false)

    // Advance past the 1-second window
    vi.advanceTimersByTime(1001)

    expect(checkRateLimit(KEY).allowed).toBe(true)
  })

  it('isolates buckets by key', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(KEY)
    expect(checkRateLimit(KEY).allowed).toBe(false)
    expect(checkRateLimit('other-key').allowed).toBe(true)
    clearRateLimit('other-key')
  })

  it('retryAfterMs is positive when blocked', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(KEY)
    const result = checkRateLimit(KEY)
    expect(result.retryAfterMs).toBeGreaterThan(0)
    expect(result.retryAfterMs).toBeLessThanOrEqual(1000)
  })
})

describe('clearRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resets the bucket so calls are allowed again', () => {
    for (let i = 0; i < 10; i++) checkRateLimit(KEY)
    expect(checkRateLimit(KEY).allowed).toBe(false)

    clearRateLimit(KEY)

    expect(checkRateLimit(KEY).allowed).toBe(true)
    clearRateLimit(KEY)
  })

  it('is a no-op for unknown keys', () => {
    expect(() => clearRateLimit('unknown-key')).not.toThrow()
  })
})
