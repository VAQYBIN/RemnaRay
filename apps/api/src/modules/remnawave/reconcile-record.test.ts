import { describe, expect, it } from 'vitest';

import { lastReconcile, recordReconcile } from './reconcile-record';

describe('last panel reconciliation (AC-146)', () => {
  it('keeps the time and outcome of the last run, even when it checked no user', async () => {
    const store = new Map<string, string>();
    const redis = {
      set: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve('OK' as const);
      },
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
    };

    expect(await lastReconcile(redis as never)).toBeNull();
    await recordReconcile(
      redis,
      { checked: 0, drifted: 0, retried: 0, failed: 0 },
      new Date('2026-09-26T12:00:00.000Z'),
    );
    expect(await lastReconcile(redis as never)).toEqual({
      at: '2026-09-26T12:00:00.000Z',
      checked: 0,
      drifted: 0,
      retried: 0,
      failed: 0,
    });
  });
});
