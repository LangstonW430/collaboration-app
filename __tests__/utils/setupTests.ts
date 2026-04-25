import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'

// Suppress noisy React 18 act() warnings in test output
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('act(')) return
    originalError(...args)
  }
})
afterAll(() => {
  console.error = originalError
})

// Restore all stubs/spies after each test to prevent cross-test pollution
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Mock next/navigation so hooks in tested components don't throw
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock convex/react so useConvexAuth doesn't require a live client
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: vi.fn(() => ({ isLoading: false, isAuthenticated: true })),
    useQuery: vi.fn(() => undefined),
    useMutation: vi.fn((fn: unknown) => fn),
  }
})

// Mock @convex-dev/auth/react
vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: vi.fn(() => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
  ConvexAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Provide a stable crypto.randomUUID in jsdom (not always present)
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      getRandomValues: (buf: Uint8Array) => {
        for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256)
        return buf
      },
    },
    configurable: true,
  })
}

// matchMedia stub — required by some component libraries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
