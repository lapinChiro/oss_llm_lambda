import { defineConfig } from 'vitest/config'
import { defaultServerConditions } from 'vite'

const appSourceConditions = ['app-source', ...defaultServerConditions.filter((condition) => condition !== 'module')]

/** Mutation testing targets high-value, fast domain/error unit tests. */
export default defineConfig({
  ssr: { resolve: { conditions: appSourceConditions } },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/errors/database-error-converter.test.ts', 'src/services/todo.service.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
})
