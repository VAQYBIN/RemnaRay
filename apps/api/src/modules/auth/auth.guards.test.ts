import { describe, expect, it } from 'vitest';

import { equalToken, readCookie, trustedInternal } from './auth.guards';

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
