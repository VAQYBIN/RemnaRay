import { describe, expect, it } from 'vitest';
import { limit } from '@grammyjs/ratelimiter';

type FakeRedis = {
  counts: Map<string, number>;
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
};

describe('Telegram anti-spam middleware', () => {
  it('drops the 21st update in a ten-second per-user window', async () => {
    const redis: FakeRedis = {
      counts: new Map(),
      incr(key) {
        const value = (this.counts.get(key) ?? 0) + 1;
        this.counts.set(key, value);
        return Promise.resolve(value);
      },
      pexpire() {
        return Promise.resolve(1);
      },
    };
    const middleware = limit({
      timeFrame: 10_000,
      limit: 20,
      storageClient: redis,
      keyPrefix: 'test:',
      keyGenerator: (ctx) => ctx.from?.id.toString(),
    });
    let processed = 0;
    const ctx = { from: { id: 42 } } as Parameters<typeof middleware>[0];
    for (let index = 0; index < 21; index += 1)
      await middleware(ctx, () => {
        processed += 1;
        return Promise.resolve();
      });
    expect(processed).toBe(20);
  });
});
