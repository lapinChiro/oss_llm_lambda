import { defineConfig } from 'vitest/config'
import { defaultServerConditions } from 'vite'

const appSourceConditions = ['app-source', ...defaultServerConditions.filter((condition) => condition !== 'module')]

export default defineConfig({
  ssr: { resolve: { conditions: appSourceConditions } },
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    exclude: ['src/db/migrations/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Migration lifecycle is exercised against PGlite and PostgreSQL; CLI logging/process-exit
      // branches are deployment wiring rather than application logic.
      exclude: ['src/db/generated-types.ts', 'src/db/migrate.ts', 'src/db/migrations/**'],
      thresholds: { branches: 75, functions: 75, lines: 75, statements: 75 },
    },
  },
})
