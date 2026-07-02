import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Runs the happy-path E2E specs against a running Evenly instance.
 * By default it boots `next dev` (reusing an already-running server, e.g. the
 * dockerised app on :3000). Requires the Postgres service to be up.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        // The spec registers a throwaway user, which needs open registration.
        // NB: this only applies when Playwright launches the server; a reused,
        // already-running app must set REGISTRATION_ENABLED=true itself.
        env: { REGISTRATION_ENABLED: 'true' },
      },
});
