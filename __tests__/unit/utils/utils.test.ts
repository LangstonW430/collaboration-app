import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce, formatDate, formatRelativeDate } from '@/lib/utils'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the function after the delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('a')
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('resets the timer on every call, firing only once', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('a')
    vi.advanceTimersByTime(50)
    debounced('b')
    vi.advanceTimersByTime(50)
    debounced('c')
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('passes all arguments to the wrapped function', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 50)

    debounced(1, 2, 3)
    vi.advanceTimersByTime(50)

    expect(fn).toHaveBeenCalledWith(1, 2, 3)
  })
})

describe('formatDate', () => {
  it('formats a numeric timestamp (local noon avoids timezone day-shift)', () => {
    // new Date(year, month-1, day) creates local midnight — safe in any timezone
    const ts = new Date(2024, 0, 15).getTime() // Jan 15 local time
    const result = formatDate(ts)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2024/)
  })

  it('formats a numeric timestamp in June', () => {
    const ts = new Date(2023, 5, 15).getTime() // June 15 local time
    const result = formatDate(ts)
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/2023/)
  })

  it('returns a non-empty string for valid input', () => {
    expect(formatDate(new Date(2020, 11, 31).getTime())).toBeTruthy()
  })
})

describe('formatRelativeDate', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0).getTime()

  it('reports moments ago as "just now"', () => {
    expect(formatRelativeDate(now - 5_000, now)).toBe('just now')
  })

  it('reports minutes, hours and days for recent times', () => {
    expect(formatRelativeDate(now - 5 * 60_000, now)).toBe('5m ago')
    expect(formatRelativeDate(now - 3 * 3_600_000, now)).toBe('3h ago')
    expect(formatRelativeDate(now - 2 * 86_400_000, now)).toBe('2d ago')
  })

  it('falls back to a calendar date after a week', () => {
    const result = formatRelativeDate(now - 30 * 86_400_000, now)
    expect(result).toMatch(/May/)
    expect(result).toMatch(/2026/)
  })

  it('treats a slightly future timestamp as "just now" rather than negative', () => {
    expect(formatRelativeDate(now + 2_000, now)).toBe('just now')
  })
})
