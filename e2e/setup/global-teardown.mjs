import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

export default async function globalTeardown() {
  const stack = globalThis.__rrStack;
  const wizard = globalThis.__rrWizardStack;
  if (stack) await stack.stop();
  if (wizard) await wizard.stop();
  rmSync(resolve(process.cwd(), 'e2e/.stack.json'), { force: true });
  rmSync(resolve(process.cwd(), 'e2e/.auth'), { force: true, recursive: true });
}
