import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    pool: 'forks',
    testTimeout: 5000,
    include: ['src/composables/useTodos.test.ts', 'src/api/todos-api.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
})
