// In-memory sliding-window rate limiter (per browser session).
// Intended for client-side throttling only — not a substitute for backend protection.

const WINDOW_MS = 1_000  // 1-second sliding window
const MAX_CALLS = 10     // max mutations per window

interface Bucket {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  /** Calls remaining in the current window */
  remaining: number
  /** Milliseconds until the oldest call leaves the window (0 when allowed) */
  retryAfterMs: number
}

function getOrCreate(key: string): Bucket {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(key, bucket)
  }
  return bucket
}

function evict(bucket: Bucket, now: number): void {
  const cutoff = now - WINDOW_MS
  // Remove timestamps that have fallen outside the window
  let i = 0
  while (i < bucket.timestamps.length && bucket.timestamps[i] <= cutoff) i++
  if (i > 0) bucket.timestamps.splice(0, i)
}

/**
 * Records a call attempt for `key` and returns whether it is permitted.
 *
 * Keys are arbitrary strings — use a stable per-user or per-document
 * identifier so the limit is scoped correctly.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now()
  const bucket = getOrCreate(key)
  evict(bucket, now)

  if (bucket.timestamps.length >= MAX_CALLS) {
    const oldest = bucket.timestamps[0]
    const retryAfterMs = WINDOW_MS - (now - oldest)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  bucket.timestamps.push(now)
  return {
    allowed: true,
    remaining: MAX_CALLS - bucket.timestamps.length,
    retryAfterMs: 0,
  }
}

/** Remove all rate-limit state for a key (e.g. on sign-out). */
export function clearRateLimit(key: string): void {
  buckets.delete(key)
}
