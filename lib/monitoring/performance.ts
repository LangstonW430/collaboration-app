const SLOW_THRESHOLD_MS = 5_000;
const MAX_SAMPLES = 1_000;

interface OperationMetrics {
  samples: number[];
}

const store = new Map<string, OperationMetrics>();

function record(name: string, duration: number): void {
  let m = store.get(name);
  if (!m) {
    m = { samples: [] };
    store.set(name, m);
  }
  m.samples.push(duration);
  if (m.samples.length > MAX_SAMPLES) m.samples.shift();

  if (duration > SLOW_THRESHOLD_MS) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        type: "slow_operation",
        operation: name,
        duration_ms: duration,
        threshold_ms: SLOW_THRESHOLD_MS,
      })
    );
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Time `fn`, record the duration, re-throw any error. */
export async function measureOperation<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    record(name, performance.now() - start);
    return result;
  } catch (err) {
    record(name, performance.now() - start);
    throw err;
  }
}

export interface OperationStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  count: number;
}

export function getMetrics(name: string): OperationStats | null {
  const m = store.get(name);
  if (!m || m.samples.length === 0) return null;
  const sorted = [...m.samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg: sorted.reduce((s, v) => s + v, 0) / sorted.length,
    count: sorted.length,
  };
}

/** Snapshot all recorded operation stats. */
export function exportMetrics(): Record<string, OperationStats | null> {
  const out: Record<string, OperationStats | null> = {};
  for (const name of store.keys()) out[name] = getMetrics(name);
  return out;
}
