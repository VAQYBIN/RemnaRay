import { hash, verify } from '@node-rs/argon2';
import * as OTPAuth from 'otpauth';

import { decryptSetting, encryptSetting } from '../settings/settings.crypto';

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
};

export function hashAdminPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyAdminPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function createTotp(label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: 'RemnaRay',
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret(),
  });
}

export function totpFromBase32(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: 'RemnaRay',
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function encryptTotpSecret(secret: string, appKey: string): string {
  return encryptSetting(secret, appKey).enc;
}

export function decryptTotpSecret(secret: string, appKey: string): string {
  const value = decryptSetting({ enc: secret }, appKey);
  if (typeof value !== 'string') throw new Error('Invalid encrypted TOTP secret');
  return value;
}
