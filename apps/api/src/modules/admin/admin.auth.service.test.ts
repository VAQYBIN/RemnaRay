import { describe, expect, it, vi } from 'vitest';
import * as OTPAuth from 'otpauth';

import { hashAdminPassword } from './admin.crypto';
import { AdminAuthService } from './admin.auth.service';

type MockRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null>;
  del(key: string): Promise<number>;
};

function createFixture() {
  const values = new Map<string, string>();
  const admin = {
    id: 'admin-1',
    email: 'owner@example.com',
    passwordHash: '',
    role: 'admin' as const,
    isActive: true,
    deletedAt: null,
    totpEnabled: false,
    totpSecretEnc: null as string | null,
    failedLogins: 0,
    lockedUntil: null as Date | null,
    telegramId: null,
  };
  const redis: MockRedis = {
    get: (key) => Promise.resolve(values.get(key) ?? null),
    set: (key, value) => {
      values.set(key, value);
      return Promise.resolve('OK');
    },
    del: (key) => {
      values.delete(key);
      return Promise.resolve(1);
    },
  };
  const infra = {
    redis,
    db: {
      admin: {
        findUnique: () => Promise.resolve(admin),
        findUniqueOrThrow: () => Promise.resolve(admin),
        update: ({ data }: { data: Record<string, unknown> }) => {
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && 'increment' in value) {
              const current = admin[key as 'failedLogins'];
              admin[key as 'failedLogins'] = current + (value as { increment: number }).increment;
            } else {
              Object.assign(admin, { [key]: value });
            }
          }
          return Promise.resolve(admin);
        },
      },
      auditLog: { create: vi.fn(() => Promise.resolve()) },
    },
  };
  return { admin, infra, values, service: new AdminAuthService(infra as never) };
}

describe('admin authentication', () => {
  it('locks the account on the fifth wrong password', async () => {
    const fixture = createFixture();
    fixture.admin.passwordHash = await hashAdminPassword('correct');

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = fixture.service.login({ email: fixture.admin.email, password: 'wrong' });
      await expect(result).rejects.toMatchObject({
        code: attempt === 5 ? 'ADMIN_LOCKED' : 'ADMIN_INVALID_CREDENTIALS',
      });
    }
    expect(fixture.admin.lockedUntil).toBeInstanceOf(Date);
  }, 30_000);

  it('provisions TOTP and creates a 12-hour admin session after confirmation', async () => {
    const previousKey = process.env.RR_APP_KEY;
    process.env.RR_APP_KEY = Buffer.alloc(32, 7).toString('base64');
    try {
      const fixture = createFixture();
      fixture.admin.passwordHash = await hashAdminPassword('correct');
      const login = await fixture.service.login({
        email: fixture.admin.email,
        password: 'correct',
      });
      const setup = await fixture.service.setup({ challengeId: login.challengeId });
      const totp = OTPAuth.URI.parse(setup.otpauthUrl);
      const confirmed = await fixture.service.confirm({
        challengeId: login.challengeId,
        code: totp.generate(),
      });

      expect(confirmed.admin.role).toBe('admin');
      expect(confirmed.csrfToken).toHaveLength(43);
      expect(confirmed.sessionId).toHaveLength(43);
      expect(fixture.admin.totpEnabled).toBe(true);
      expect(fixture.infra.db.auditLog.create).toHaveBeenCalled();
      expect(fixture.admin.totpSecretEnc).not.toBeNull();
      expect(fixture.admin.totpSecretEnc).not.toContain(totp.secret.base32);
    } finally {
      if (previousKey === undefined) delete process.env.RR_APP_KEY;
      else process.env.RR_APP_KEY = previousKey;
    }
  }, 30_000);

  it('never writes the pending TOTP secret to Valkey in plaintext', async () => {
    const previousKey = process.env.RR_APP_KEY;
    process.env.RR_APP_KEY = Buffer.alloc(32, 7).toString('base64');
    try {
      const fixture = createFixture();
      fixture.admin.passwordHash = await hashAdminPassword('correct');
      const login = await fixture.service.login({
        email: fixture.admin.email,
        password: 'correct',
      });
      const setup = await fixture.service.setup({ challengeId: login.challengeId });
      const secret = OTPAuth.URI.parse(setup.otpauthUrl).secret.base32;
      const stored = [...fixture.values.values()].join('|');

      expect(stored).not.toContain(secret);
      expect(stored).toContain('pendingSecretEnc');
    } finally {
      if (previousKey === undefined) delete process.env.RR_APP_KEY;
      else process.env.RR_APP_KEY = previousKey;
    }
  }, 30_000);

  it('consumes the challenge so a replayed confirmation cannot mint a second session', async () => {
    const previousKey = process.env.RR_APP_KEY;
    process.env.RR_APP_KEY = Buffer.alloc(32, 7).toString('base64');
    try {
      const fixture = createFixture();
      fixture.admin.passwordHash = await hashAdminPassword('correct');
      const login = await fixture.service.login({
        email: fixture.admin.email,
        password: 'correct',
      });
      const setup = await fixture.service.setup({ challengeId: login.challengeId });
      const totp = OTPAuth.URI.parse(setup.otpauthUrl);
      await fixture.service.confirm({ challengeId: login.challengeId, code: totp.generate() });

      await expect(
        fixture.service.confirm({ challengeId: login.challengeId, code: totp.generate() }),
      ).rejects.toMatchObject({ code: 'ADMIN_INVALID_CREDENTIALS' });
    } finally {
      if (previousKey === undefined) delete process.env.RR_APP_KEY;
      else process.env.RR_APP_KEY = previousKey;
    }
  }, 30_000);
});
