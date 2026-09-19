import { Queue } from 'bullmq';
import { Prisma, type PrismaClient } from '@remnaray/db';
import { Redis as RedisClient } from 'ioredis';

export const QUEUE_NAMES = ['panel', 'payments', 'notify', 'broadcast', 'maintenance'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export type OutboxMessage = {
  queue: QueueName;
  name: string;
  payload: Record<string, unknown>;
  jobId?: string;
};

export class OutboxWriter {
  async enqueue(transaction: Prisma.TransactionClient, message: OutboxMessage): Promise<string> {
    const row = await transaction.outboxJob.create({
      data: {
        queue: message.queue,
        name: message.name,
        payload: message.payload as never,
        ...(message.jobId ? { jobId: message.jobId } : {}),
      },
      select: { id: true },
    });
    return row.id;
  }
}

export type RelayResult = { published: number; remaining: number };

export class OutboxRelay {
  private readonly queues: Map<QueueName, Queue>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisClient,
  ) {
    this.queues = new Map(
      QUEUE_NAMES.map((name) => [name, new Queue(name, { connection: redis, prefix: 'rr:q' })]),
    );
  }

  async runOnce(limit = 100): Promise<RelayResult> {
    const published = await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{
          id: string;
          queue: string;
          name: string;
          payload: Record<string, unknown>;
          jobId: string | null;
        }>
      >(Prisma.sql`
        SELECT id, queue, name, payload, job_id AS "jobId"
        FROM outbox_jobs WHERE published_at IS NULL ORDER BY created_at, id LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `);
      let count = 0;
      for (const row of rows) {
        if (!QUEUE_NAMES.includes(row.queue as QueueName)) continue;
        const queue = this.queues.get(row.queue as QueueName);
        if (!queue) continue;
        await queue.add(row.name, row.payload, {
          jobId: row.jobId ?? row.id,
          removeOnComplete: 1000,
          removeOnFail: 5000,
        });
        await transaction.outboxJob.update({
          where: { id: row.id },
          data: { publishedAt: new Date() },
        });
        count += 1;
      }
      return count;
    });
    const aggregate = await this.prisma.outboxJob.aggregate({
      _count: { _all: true },
      where: { publishedAt: null },
    });
    const count = aggregate._count._all;
    return { published, remaining: count };
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}

export function createRedisConnection(
  url = process.env.VALKEY_URL ?? 'redis://valkey:6379/0',
): RedisClient {
  return new RedisClient(url, { maxRetriesPerRequest: null, lazyConnect: true });
}
