import Redis from 'ioredis';
import type { ThrottlerStorage } from '@nestjs/throttler';

type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

export class ValkeyThrottlerStorage implements ThrottlerStorage {
  private readonly redis: Redis;

  constructor(redisUrl = process.env.VALKEY_URL ?? 'redis://valkey:6379/0') {
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `rr:rl:${throttlerName}:${key}`;
    const blockKey = `${counterKey}:blocked`;
    const [totalHits, blockTtl] = await Promise.all([
      this.redis.incr(counterKey),
      this.redis.pttl(blockKey),
    ]);
    if (totalHits === 1) await this.redis.pexpire(counterKey, ttl);

    const isBlocked = blockTtl > 0;
    if (!isBlocked && totalHits > limit) await this.redis.set(blockKey, '1', 'PX', blockDuration);
    const remainingBlockTtl = isBlocked ? blockTtl : totalHits > limit ? blockDuration : -1;
    const counterTtl = await this.redis.pttl(counterKey);
    return {
      totalHits,
      timeToExpire: Math.max(1, Math.ceil(counterTtl / 1000)),
      isBlocked: remainingBlockTtl > 0 || totalHits > limit,
      timeToBlockExpire: remainingBlockTtl > 0 ? Math.ceil(remainingBlockTtl / 1000) : -1,
    };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
