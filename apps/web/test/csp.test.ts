import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy } from '../lib/csp';

/** Section 19.3's policy, directive by directive, plus oauth.telegram.org for the OIDC login (F29). */
const SECTION_19_3 = [
  "default-src 'self'",
  "script-src 'self' https://telegram.org https://oauth.telegram.org 'nonce-N0NCE'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://t.me https://telegram.org",
  'frame-src https://oauth.telegram.org',
  "connect-src 'self' https://oauth.telegram.org",
  "font-src 'self'",
  "frame-ancestors 'none'",
];

describe('the Content-Security-Policy web owns (sections 19.3, 22.7)', () => {
  it('carries every directive the specification lists, and the nonce', () => {
    const policy = contentSecurityPolicy('N0NCE');

    expect(policy.split('; ')).toEqual(SECTION_19_3);
  });

  it('allows no inline script, so Next.js has to be given the nonce', () => {
    const policy = contentSecurityPolicy('N0NCE');

    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain('unsafe-eval');
  });
});
