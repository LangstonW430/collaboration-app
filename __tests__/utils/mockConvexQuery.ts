import { vi } from 'vitest'

/**
 * Creates a vi.fn() that mimics the return value of a Convex useQuery hook.
 * Returns undefined on first call (loading), then the value on subsequent calls.
 */
export function createMockQuery<TReturn>(
  value: TReturn,
  opts: { loading?: boolean; fail?: Error } = {}
) {
  if (opts.fail) {
    return vi.fn().mockRejectedValue(opts.fail)
  }
  if (opts.loading) {
    return vi.fn().mockReturnValue(undefined)
  }
  // Mimic Convex: undefined while loading, then data
  let called = false
  return vi.fn().mockImplementation(() => {
    if (!called) {
      called = true
      return undefined
    }
    return value
  })
}

/**
 * Creates a resolved query mock that immediately returns the given value.
 * Useful when loading state isn't relevant to the test.
 */
export function createResolvedQuery<TReturn>(value: TReturn) {
  return vi.fn().mockReturnValue(value)
}
