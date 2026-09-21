import { describe, expect, it } from 'vitest';

import { workerValkeyUrl } from './worker-config';

describe('worker configuration', () => {
  it('uses the documented VALKEY_URL and does not require legacy variables', () => {
    expect(workerValkeyUrl({ VALKEY_URL: 'redis://valkey.internal:6380/2' })).toBe(
      'redis://valkey.internal:6380/2',
    );
    expect(workerValkeyUrl({})).toBe('redis://valkey:6379/0');
    expect(workerValkeyUrl({ RR_WORKER_ENABLED: undefined, RR_VALKEY_HOST: undefined })).toBe(
      'redis://valkey:6379/0',
    );
  });
});
