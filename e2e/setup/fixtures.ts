import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import * as OTPAuth from 'otpauth';

export type StackState = {
  baseURL: string;
  apiUrl: string;
  internalToken: string;
  botToken: string;
  brand: { name: string };
  admin: { email: string; password: string; totpSecret: string };
  plan: { id: string; slug: string; name: string };
  user: { id: string; telegramId: string; username: string; firstName: string };
  wizard: {
    baseURL: string;
    apiUrl: string;
    setupToken: string;
    panelUrl: string;
    botToken: string;
  };
};

export const ADMIN_STORAGE_STATE = resolve(process.cwd(), 'e2e/.auth/admin.json');

/** What `apps/api/src/tools/seed-dev.ts` wrote about a stand it seeded. */
type StandFixture = {
  brand: StackState['brand'];
  admin: StackState['admin'];
  plans: StackState['plan'][];
  user: StackState['user'];
  botToken?: string;
};

/**
 * The smoke stand of section 22.7 is seeded by `seed-dev` rather than by this
 * harness, so its fixture is read from where that tool wrote it and given the
 * shape the specs expect. Everything reaches it through the proxy, which is
 * what the base URL already names.
 */
function standState(path: string): StackState {
  const stand = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as StandFixture;
  const baseURL = process.env.RR_E2E_BASE_URL ?? '';
  const plan = stand.plans[0];
  if (!plan) throw new Error(`${path} seeded no plans`);
  return {
    baseURL,
    apiUrl: baseURL,
    internalToken: process.env.RR_E2E_INTERNAL_TOKEN ?? '',
    botToken: stand.botToken ?? process.env.RR_E2E_BOT_TOKEN ?? '',
    brand: stand.brand,
    admin: stand.admin,
    plan,
    user: stand.user,
    wizard: { baseURL, apiUrl: baseURL, setupToken: '', panelUrl: '', botToken: '' },
  };
}

export function stackState(): StackState {
  const stand = process.env.RR_E2E_STAND_FILE;
  if (stand) return standState(stand);
  return JSON.parse(readFileSync(resolve(process.cwd(), 'e2e/.stack.json'), 'utf8')) as StackState;
}

const PERIOD_SECONDS = 30;
const PERIOD_FILE = resolve(process.cwd(), 'e2e/.auth/totp-period');

/**
 * A TOTP code may be redeemed once (`rr:admin:totp:<id>:<counter>`), so two
 * sign-ins inside the same 30-second period must not present the same code.
 * The last consumed period is kept on disk because the setup project and the
 * specs run in separate worker processes.
 */
function readUsedPeriod(): number {
  try {
    return Number.parseInt(readFileSync(PERIOD_FILE, 'utf8'), 10);
  } catch {
    return -1;
  }
}

export async function freshTotp(secret: string, label: string): Promise<string> {
  const totp = new OTPAuth.TOTP({
    issuer: 'RemnaRay',
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const used = readUsedPeriod();

  let period = Math.floor(Date.now() / (PERIOD_SECONDS * 1000));
  while (period === used) {
    await new Promise((done) => setTimeout(done, 1000));
    period = Math.floor(Date.now() / (PERIOD_SECONDS * 1000));
  }

  mkdirSync(dirname(PERIOD_FILE), { recursive: true });
  writeFileSync(PERIOD_FILE, String(period), 'utf8');
  return totp.generate();
}
