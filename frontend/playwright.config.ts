import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 5173);
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 4000);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${FRONTEND_PORT}`,
    headless: true,
    viewport: { width: 1280, height: 768 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm run dev:e2e --workspace backend',
      cwd: '..',
      port: BACKEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: 'npm run dev',
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
