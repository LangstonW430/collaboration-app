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
      include: ['lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: [
        'lib/**/*.test.ts',
        'lib/**/*.d.ts',
        'convex/_generated/**',
      ],
    },
  },
})
