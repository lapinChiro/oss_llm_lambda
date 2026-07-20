import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5180', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'env NODE_OPTIONS=--conditions=app-source PORT=3010 FRONTEND_URL=http://127.0.0.1:5180 DB_HOST=127.0.0.1 DB_PORT=5435 DB_USER=postgres DB_PASSWORD=password DB_NAME=app_dev DATABASE_URL=postgresql://postgres:password@127.0.0.1:5435/app_dev npm run dev -w backend',
      cwd: '../..', port: 3010, reuseExistingServer: false,
      stdout: 'pipe', stderr: 'pipe',
    },
    { command: 'env VITE_API_BASE_URL=http://127.0.0.1:3010 npm run dev -- --host 127.0.0.1 --port 5180', port: 5180, reuseExistingServer: false, stdout: 'pipe', stderr: 'pipe' },
  ],
})
