import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const valid = {
  RR_DOMAIN: 'shop.example.com',
  RR_ACME_EMAIL: 'owner@example.com',
  RR_PROXY_PROFILE: 'nginx',
  RR_TLS_MODE: 'acme',
  RR_APP_KEY: 'a'.repeat(43),
  RR_SETUP_TOKEN: 'setup-token',
  RR_INTERNAL_TOKEN: 'internal-token',
  POSTGRES_PASSWORD: 'database-password',
};

describe('loadEnv', () => {
  it('loads required values and safe defaults', () => {
    const result = loadEnv(valid);
    expect(result.RR_PROXY_PROFILE).toBe('nginx');
    expect(result.POSTGRES_USER).toBe('remnaray');
    expect(result.VALKEY_URL).toBe('redis://valkey:6379/0');
    expect(result.RR_API_DOCS).toBe(false);
  });

  it('requires ACME email only for ACME mode', () => {
    expect(() => loadEnv({ ...valid, RR_ACME_EMAIL: undefined })).toThrow('RR_ACME_EMAIL');
    expect(loadEnv({ ...valid, RR_ACME_EMAIL: undefined, RR_TLS_MODE: 'none' }).RR_TLS_MODE).toBe(
      'none',
    );
  });

  it('rejects TLS with an external proxy', () => {
    expect(() => loadEnv({ ...valid, RR_PROXY_PROFILE: 'external' })).toThrow('RR_TLS_MODE');
    expect(
      loadEnv({ ...valid, RR_PROXY_PROFILE: 'external', RR_TLS_MODE: 'none' }).RR_PROXY_PROFILE,
    ).toBe('external');
  });

  it('does not include secret values in validation errors', () => {
    expect(() => loadEnv({ ...valid, RR_APP_KEY: '' })).toThrow('RR_APP_KEY');
    expect(() => loadEnv({ ...valid, RR_APP_KEY: '' })).not.toThrow('database-password');
  });
});
