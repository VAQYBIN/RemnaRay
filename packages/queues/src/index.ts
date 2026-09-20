import { Queue } from 'bullmq';
import { Prisma, type PrismaClient } from '@remnaray/db';
import { Redis as RedisClient } from 'ioredis';

export const QUEUE_NAMES = ['panel', 'payments', 'notify', 'broadcast', 'maintenance'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

/**
 * The Valkey key prefix every queue uses. It is exported because a producer
 * and a consumer that disagree about it share a queue name and nothing else:
 * the relay publishes, the worker waits, and neither reports a problem.
 */
export const QUEUE_PREFIX = 'rr:q';

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

/**
 * BullMQ refuses a custom job id that contains a colon or that is all digits:
 * the first is its own key separator and the second collides with the ids it
 * generates. The application builds ids like `alert:payment.late:<uuid>`, so
 * the separator is translated here, at the boundary with BullMQ, rather than
 * left to twenty-odd call sites to remember.
 *
 * `outbox_jobs.job_id` keeps the readable form; only what BullMQ is told
 * changes, and the mapping is one-to-one, so deduplication is unaffected.
 */
export function toJobId(value: string): string {
  const safe = value.replaceAll(':', '-');
  return /^\d+$/u.test(safe) ? `j-${safe}` : safe;
}

export type RelayResult = { published: number; remaining: number };

export class OutboxRelay {
  private readonly queues: Map<QueueName, Queue>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisClient,
  ) {
    this.queues = new Map(
      QUEUE_NAMES.map((name) => [
        name,
        new Queue(name, { connection: redis, prefix: QUEUE_PREFIX }),
      ]),
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
          jobId: toJobId(row.jobId ?? row.id),
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
