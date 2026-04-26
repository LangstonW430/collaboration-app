import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import the module fresh each test suite to reset the module-level store
// (vitest isolates modules per file by default with the jsdom environment)
import { measureOperation, getMetrics, exportMetrics } from '@/lib/monitoring/performance'

const OP = 'test-op'

describe('measureOperation', () => {
  it('returns the value from the async function', async () => {
    const result = await measureOperation(OP, async () => 42)
    expect(result).toBe(42)
  })

  it('re-throws errors from the async function', async () => {
    await expect(
      measureOperation(OP, async () => { throw new Error('boom') })
    ).rejects.toThrow('boom')
  })

  it('records a sample even when the function throws', async () => {
    const before = getMetrics(OP)?.count ?? 0
    await measureOperation(OP, async () => { throw new Error() }).catch(() => {})
    const after = getMetrics(OP)
    expect(after?.count).toBeGreaterThan(before)
  })

  it('warns when the operation exceeds 5 seconds', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(globalThis, 'performance', 'get').mockReturnValue({
      now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(6000),
    } as unknown as Performance)

    await measureOperation('slow-op', async () => 'done')

    expect(spy).toHaveBeenCalledOnce()
    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged.type).toBe('slow_operation')
    expect(logged.operation).toBe('slow-op')

    spy.mockRestore()
    vi.restoreAllMocks()
  })
})

describe('getMetrics', () => {
  beforeEach(async () => {
    // Seed a few samples under a known name
    for (const ms of [10, 20, 30, 40, 50]) {
      await measureOperation('latency', async () => {
        // We can't control real time here, but we can measure the function exists
      })
    }
  })

  it('returns null for an unknown operation', () => {
    expect(getMetrics('does-not-exist')).toBeNull()
  })

  it('returns stats with expected shape', async () => {
    const stats = getMetrics('latency')
    expect(stats).not.toBeNull()
    expect(stats).toHaveProperty('p50')
    expect(stats).toHaveProperty('p95')
    expect(stats).toHaveProperty('p99')
    expect(stats).toHaveProperty('avg')
    expect(stats).toHaveProperty('count')
  })

  it('count equals the number of recorded samples', async () => {
    const key = 'count-test'
    await measureOperation(key, async () => {})
    await measureOperation(key, async () => {})
    await measureOperation(key, async () => {})
    const stats = getMetrics(key)
    expect(stats?.count).toBe(3)
  })

  it('p99 >= p95 >= p50', async () => {
    const key = 'percentile-order'
    for (let i = 0; i < 20; i++) {
      await measureOperation(key, async () => {})
    }
    const stats = getMetrics(key)!
    expect(stats.p99).toBeGreaterThanOrEqual(stats.p95)
    expect(stats.p95).toBeGreaterThanOrEqual(stats.p50)
  })
})

describe('exportMetrics', () => {
  it('returns an object', () => {
    const result = exportMetrics()
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })

  it('includes keys for all recorded operations', async () => {
    const key = 'export-test'
    await measureOperation(key, async () => {})
    const result = exportMetrics()
    expect(key in result).toBe(true)
  })
})
