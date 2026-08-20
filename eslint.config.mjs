import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '.next/**',
    'coverage/**',
    'test-results/**',
    'playwright-report/**',
    'convex/_generated/**',
    'next-env.d.ts',
  ]),

  // Application source: browser globals, React rules, Next.js rules.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
    ],
    plugins: { '@next/next': nextPlugin },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Unused function arguments are often required by a signature; allow
      // them when prefixed with an underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Convex functions run on the server, not in a browser.
  {
    files: ['convex/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Tests get the test-runner globals and may assert on loose shapes.
  {
    files: ['**/*.test.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Config files are plain Node modules.
  {
    files: ['*.config.{js,mjs,ts}', '*.config.mts'],
    languageOptions: { globals: globals.node },
  },
])
