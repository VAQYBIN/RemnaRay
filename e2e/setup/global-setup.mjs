import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { startStack } from './stack.mjs';

const stateFile = resolve(process.cwd(), 'e2e/.stack.json');

export default async function globalSetup() {
  // Two stacks: the seeded shop the section 22.1 specs use, and an empty one
  // whose setup has not run, which is the only state AC-171 can be checked in.
  // They start one after the other because both copy `.next/static` into the
  // shared standalone output.
  const stack = await startStack();
  const wizard = await startStack({ seed: false });
  process.env.RR_E2E_BASE_URL = stack.baseURL;
  writeFileSync(
    stateFile,
    JSON.stringify(
      {
        baseURL: stack.baseURL,
        apiUrl: stack.apiUrl,
        internalToken: stack.internalToken,
        // The seeded bot's token: the landing's Telegram Login callback is
        // signed with it (section 13.3).
        botToken: stack.botToken,
        oidcPrivateKey: stack.oidcPrivateKey,
        brand: stack.brand,
        admin: stack.admin,
        plan: stack.plan,
        user: stack.user,
        wizard: {
          baseURL: wizard.baseURL,
          apiUrl: wizard.apiUrl,
          setupToken: wizard.setupToken,
          panelUrl: wizard.panelUrl,
          botToken: wizard.botToken,
        },
      },
      null,
      2,
    ),
  );
  globalThis.__rrStack = stack;
  globalThis.__rrWizardStack = wizard;
}
