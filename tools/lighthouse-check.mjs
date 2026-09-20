/**
 * NFR-010 and the TASK-M4-003 acceptance gate: Lighthouse performance >= 90,
 * accessibility >= 90 and SEO >= 95 for the landing, and accessibility >= 90
 * for the account (section 13.2).
 *
 * The measurement runs against the same production stack the Playwright suite
 * uses — the API from `dist`, the site from its standalone build and a reverse
 * proxy in front of both — so the numbers describe the deployed artefacts and
 * not a development server.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

import { startStack } from '../e2e/setup/stack.mjs';

const REPORT_DIRECTORY = resolve(process.cwd(), 'test-results/lighthouse');

/** Section 13.2 thresholds; the account only carries the NFR-010 a11y gate. */
const TARGETS = [
  { name: 'landing-ru', path: '/ru', thresholds: { performance: 90, accessibility: 90, seo: 95 } },
  { name: 'landing-en', path: '/en', thresholds: { performance: 90, accessibility: 90, seo: 95 } },
  {
    name: 'account',
    path: '/account',
    signIn: true,
    // The locale is negotiated from `Accept-Language`, so either prefix is right.
    expected: /^\/(ru|en)\/account$/u,
    thresholds: { accessibility: 90 },
  },
];

/**
 * The entry URL the bot's «Открыть кабинет» button uses (section 13.3).
 * Lighthouse clears storage before it navigates, so the session has to be
 * established by the navigation itself rather than by a cookie set up front.
 */
async function signInUrl(stack) {
  const issued = await globalThis.fetch(`${stack.apiUrl}/api/internal/v1/auth/issue-token`, {
    method: 'POST',
    headers: { 'x-internal-token': stack.internalToken, 'content-type': 'application/json' },
    body: JSON.stringify({ telegramId: stack.user.telegramId }),
  });
  if (!issued.ok) throw new Error(`issue-token failed with ${String(issued.status)}`);
  const { token } = await issued.json();
  return `${stack.baseURL}/auth/tg?token=${encodeURIComponent(token)}`;
}

async function audit(url, { port, categories }) {
  const { lhr } = await lighthouse(
    url,
    { port, output: 'json', logLevel: 'error', onlyCategories: categories },
    desktopConfig,
  );
  return lhr;
}

async function main() {
  const stack = await startStack();
  // `chrome-launcher` rewrites the profile directory into a Windows path when
  // it detects WSL, which a Linux Chrome then creates as a literal
  // `C:\...`/`\\wsl.localhost\...` name in the working directory. Opt out of
  // its handling and pass the directory as a flag instead.
  const profile = mkdtempSync(join(tmpdir(), 'remnaray-lighthouse-'));
  const chrome = await chromeLauncher.launch({
    // `CHROME_PATH` wins so a machine without the full Chromium runtime can
    // point the run at `chrome-headless-shell`; CI uses Playwright's Chromium.
    chromePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--user-data-dir=${profile}`,
    ],
    userDataDir: false,
  });
  mkdirSync(REPORT_DIRECTORY, { recursive: true });

  const failures = [];
  try {
    for (const target of TARGETS) {
      const categories = Object.keys(target.thresholds);
      const url = target.signIn ? await signInUrl(stack) : `${stack.baseURL}${target.path}`;
      const lhr = await audit(url, { port: chrome.port, categories });
      const expected = target.expected ?? new RegExp(`^${target.path}$`, 'u');
      if (!expected.test(new globalThis.URL(lhr.finalDisplayedUrl).pathname))
        throw new Error(
          `${target.name} ended on ${lhr.finalDisplayedUrl}; the audit would not describe ${target.path}`,
        );
      writeFileSync(
        resolve(REPORT_DIRECTORY, `${target.name}.json`),
        JSON.stringify(lhr, null, 2),
        'utf8',
      );

      const scores = categories.map((category) => {
        const score = Math.round((lhr.categories[category].score ?? 0) * 100);
        const threshold = target.thresholds[category];
        if (score < threshold)
          failures.push(`${target.name} ${category} ${String(score)} < ${String(threshold)}`);
        return `${category} ${String(score)}/${String(threshold)}`;
      });
      process.stdout.write(`${target.name} (${target.path}): ${scores.join(', ')}\n`);
    }
  } finally {
    await chrome.kill();
    rmSync(profile, { force: true, recursive: true });
    await stack.stop();
  }

  if (failures.length > 0) {
    process.stderr.write(`Lighthouse below the section 13.2 thresholds: ${failures.join('; ')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Lighthouse thresholds met; reports written to ${REPORT_DIRECTORY}.\n`);
}

await main();
