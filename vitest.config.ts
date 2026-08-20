import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/utils/setupTests.ts'],
    include: [
      '__tests__/unit/**/*.test.ts',
      '__tests__/unit/**/*.test.tsx',
      'lib/**/*.test.ts',
      'components/**/*.test.tsx',
      // Convex function tests live beside the functions they cover. They run
      // under the edge-runtime environment via a per-file @vitest-environment
      // docblock, because convex-test emulates the Convex runtime, not a DOM.
      'convex/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next', '__tests__/e2e/**'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 60,
        functions: 50,
        branches: 40,
        statements: 60,
      },
      include: ['lib/**/*.ts', 'lib/**/*.tsx', 'convex/**/*.ts'],
      exclude: [
        // Test files
        'lib/**/*.test.ts',
        'lib/**/*.test.tsx',
        'lib/**/*.d.ts',
        // Auto-generated
        'convex/_generated/**',
        // Convex config and test scaffolding, not application logic
        'convex/**/*.test.ts',
        'convex/test.helpers.ts',
        'convex/schema.ts',
        'convex/auth.config.ts',
        'convex/http.ts',
        // TypeScript-only files (no runtime code)
        'lib/types/**',
        'lib/services/types.ts',
        // Barrel / re-export files
        'lib/services/index.ts',
        'lib/services/documentService.ts',
        'lib/services/collaborationService.ts',
        // Third-party integration wrappers — cannot unit test without extensive mocking
        'lib/logging/logger.ts',
        'lib/logging/requestLogger.ts',
        'lib/monitoring/sentry.ts',
        'lib/monitoring/convexErrors.ts',
        // React hooks and context providers — require Convex/Auth providers in test env
        'lib/audit/auditLog.ts',
        'lib/hooks/useLogger.ts',
        'lib/hooks/useDocumentService.tsx',
        'lib/hooks/useAuthService.tsx',
        'lib/context/ConnectionContext.tsx',
        'lib/hooks/useConnectionStatus.ts',
        'lib/hooks/useConvexError.ts',
      ],
    },
  },
})
