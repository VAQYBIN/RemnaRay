import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { startStack } from './stack.mjs';

const stateFile = resolve(process.cwd(), 'e2e/.stack.json');

export default async function globalSetup() {
  const stack = await startStack();
  process.env.RR_E2E_BASE_URL = stack.baseURL;
  writeFileSync(
    stateFile,
    JSON.stringify(
      {
        baseURL: stack.baseURL,
        apiUrl: stack.apiUrl,
        internalToken: stack.internalToken,
        admin: stack.admin,
        plan: stack.plan,
        user: stack.user,
      },
      null,
      2,
    ),
  );
  globalThis.__rrStack = stack;
}
