import { vi } from 'vitest'

type MutationResult<T> = T extends void ? null : T

/**
 * Creates a vi.fn() that mimics a Convex mutation.
 *
 * @param returnValue  Value the mutation resolves to (default: null)
 * @param opts.delay   Optional artificial delay in ms to simulate network latency
 * @param opts.fail    If set, the mutation rejects with this Error instead
 */
export function createMockMutation<TArgs = unknown, TReturn = null>(
  returnValue: MutationResult<TReturn> = null as MutationResult<TReturn>,
  opts: { delay?: number; fail?: Error } = {}
) {
  return vi.fn().mockImplementation((_args: TArgs): Promise<MutationResult<TReturn>> => {
    const work = opts.fail
      ? Promise.reject(opts.fail)
      : Promise.resolve(returnValue)

    return opts.delay
      ? new Promise<MutationResult<TReturn>>((resolve, reject) =>
          setTimeout(() => (opts.fail ? reject(opts.fail) : resolve(returnValue)), opts.delay)
        )
      : work
  })
}

/** Shorthand for a mutation that always succeeds with no meaningful return. */
export function createSuccessMutation() {
  return createMockMutation<unknown, null>(null)
}

/** Shorthand for a mutation that always fails with a given message. */
export function createFailingMutation(message: string, opts: { isAuth?: boolean } = {}) {
  const prefix = opts.isAuth ? 'Not authenticated: ' : ''
  return createMockMutation(null, { fail: new Error(`${prefix}${message}`) })
}
