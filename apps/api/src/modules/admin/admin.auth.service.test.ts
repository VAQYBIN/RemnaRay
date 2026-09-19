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
        update: ({ data }: { data: Partial<typeof admin> }) => {
          Object.assign(admin, data);
          return Promise.resolve(admin);
        },
      },
      auditLog: { create: vi.fn(() => Promise.resolve()) },
    },
  };
  return { admin, infra, service: new AdminAuthService(infra as never) };
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
    } finally {
      if (previousKey === undefined) delete process.env.RR_APP_KEY;
      else process.env.RR_APP_KEY = previousKey;
    }
  }, 30_000);
});
