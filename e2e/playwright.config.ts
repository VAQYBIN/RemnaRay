import { defineConfig, devices } from '@playwright/test';

/** Section 22.1 E2E: the site, the account and the administration console. */

/**
 * Step 10 of section 22.7 runs the same specs against the proxy smoke stand,
 * which is a real deployment behind a real proxy rather than the harness this
 * file otherwise starts. Then nothing is started or torn down here, and the
 * certificate is the stand's own self-signed one.
 */
const externalStack = process.env.RR_E2E_EXTERNAL_STACK === 'true';
const baseURL = process.env.RR_E2E_BASE_URL ?? 'http://127.0.0.1:3100';

const chrome = {
  ...devices['Desktop Chrome'],
  ...(externalStack ? { ignoreHTTPSErrors: true } : {}),
};

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
  ...(externalStack
    ? {}
    : { globalSetup: './setup/global-setup.mjs', globalTeardown: './setup/global-teardown.mjs' }),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: externalStack
    ? [
        {
          // Section 22.7 step 10 asks for E2E-01 against the stand: the
          // customer's path from the landing to a paid invoice, plus the sign
          // -in gates. AC-171 is not among them — it needs a shop whose wizard
          // has not run, and the stand is a finished installation — and
          // neither is the administration console, which is not part of
          // E2E-01 and whose suite drives `/api/admin` far faster than a
          // person, so it would measure the 30r/m limit of section 19.4
          // rather than anything about the proxy.
          name: 'public',
          testMatch: /(site|account|admin-login)\.spec\.ts/,
          use: chrome,
        },
      ]
    : [
        {
          name: 'setup',
          testDir: './setup',
          testMatch: /admin-auth\.setup\.ts/,
          use: chrome,
        },
        {
          name: 'public',
          testMatch: /(site|account|admin-login|setup)\.spec\.ts/,
          use: chrome,
        },
        {
          name: 'admin',
          testMatch: /admin\.spec\.ts/,
          dependencies: ['setup'],
          use: { ...chrome, storageState: 'e2e/.auth/admin.json' },
        },
      ],
});
