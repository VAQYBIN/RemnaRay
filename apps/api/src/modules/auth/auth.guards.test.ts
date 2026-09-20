import { describe, expect, it } from 'vitest';

import { CsrfGuard, equalToken, readCookie, trustedInternal } from './auth.guards';

describe('auth guard primitives', () => {
  it('parses only the expected opaque session cookie shape', () => {
    const session = 'a'.repeat(43);
    expect(readCookie(`other=x; rr_sid=${session}; next=y`, 'rr_sid')).toBe(session);
    expect(readCookie('rr_sid=short', 'rr_sid')).toBeUndefined();
  });

  it('compares internal tokens without accepting prefixes', () => {
    expect(equalToken('secret', 'secret')).toBe(true);
    expect(equalToken('secret-extra', 'secret')).toBe(false);
    expect(equalToken(undefined, 'secret')).toBe(false);
  });

  it('limits internal requests to the configured network', () => {
    const previous = process.env.RR_TRUSTED_INTERNAL_CIDR;
    process.env.RR_TRUSTED_INTERNAL_CIDR = '172.28.0.0/16';
    expect(trustedInternal('172.28.0.4')).toBe(true);
    expect(trustedInternal('127.0.0.1')).toBe(false);
    if (previous === undefined) delete process.env.RR_TRUSTED_INTERNAL_CIDR;
    else process.env.RR_TRUSTED_INTERNAL_CIDR = previous;
  });
});

function csrfContext(
  path: string,
  headers: Record<string, string>,
  admin?: { id: string; csrf: string; role: string },
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        url: path,
        routeOptions: { url: path },
        headers,
        ...(admin ? { admin } : {}),
      }),
    }),
  } as never;
}

describe('CSRF guard', () => {
  const guard = new CsrfGuard();
  const sameOrigin = { 'x-requested-with': 'RemnaRay', 'sec-fetch-site': 'same-origin' };

  it('protects admin authentication routes instead of exempting them', () => {
    expect(() => guard.canActivate(csrfContext('/api/admin/v1/auth/login', {}))).toThrow();
    expect(guard.canActivate(csrfContext('/api/admin/v1/auth/login', sameOrigin))).toBe(true);
  });

  it('requires the session CSRF token once an admin session exists', () => {
    const admin = { id: 'admin-1', csrf: 'csrf-token', role: 'admin' };
    expect(() =>
      guard.canActivate(csrfContext('/api/admin/v1/settings', sameOrigin, admin)),
    ).toThrow();
    expect(
      guard.canActivate(
        csrfContext(
          '/api/admin/v1/settings',
          { ...sameOrigin, 'x-csrf-token': 'csrf-token' },
          admin,
        ),
      ),
    ).toBe(true);
  });

  it('leaves internal, webhook and Telegram ingress untouched', () => {
    expect(guard.canActivate(csrfContext('/api/internal/v1/users/upsert', {}))).toBe(true);
    expect(guard.canActivate(csrfContext('/webhooks/yookassa', {}))).toBe(true);
    expect(guard.canActivate(csrfContext('/tg/webhook/secret', {}))).toBe(true);
  });
});
