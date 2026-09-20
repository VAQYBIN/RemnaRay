import { defineConfig, devices } from '@playwright/test';

/** Section 22.1 E2E: the site, the account and the administration console. */
export default defineConfig({
  testDir: './specs',
  outputDir: '../test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  globalSetup: './setup/global-setup.mjs',
  globalTeardown: './setup/global-teardown.mjs',
  use: {
    baseURL: process.env.RR_E2E_BASE_URL ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testDir: './setup',
      testMatch: /admin-auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public',
      testMatch: /(site|account|admin-login|setup)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
    },
  ],
});
