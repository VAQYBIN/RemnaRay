import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import * as OTPAuth from 'otpauth';

export type StackState = {
  baseURL: string;
  apiUrl: string;
  internalToken: string;
  admin: { email: string; password: string; totpSecret: string };
  plan: { id: string; slug: string };
  user: { id: string; telegramId: string };
  wizard: {
    baseURL: string;
    apiUrl: string;
    setupToken: string;
    panelUrl: string;
    botToken: string;
  };
};

export const ADMIN_STORAGE_STATE = resolve(process.cwd(), 'e2e/.auth/admin.json');

export function stackState(): StackState {
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
