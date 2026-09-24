import { Queue, type JobsOptions } from 'bullmq';
import { Prisma, type PrismaClient } from '@remnaray/db';
import { Redis as RedisClient } from 'ioredis';

/**
 * The section 7.3 queues, and `webhooks` for the outgoing webhooks of section
 * 9.8, which 7.3 does not list. A delivery waits up to ten seconds on a
 * recipient and is retried for half a day; on `notify` it would hold up the
 * customers' notifications behind a slow recipient.
 */
export const QUEUE_NAMES = [
  'panel',
  'payments',
  'notify',
  'broadcast',
  'maintenance',
  'webhooks',
] as const;
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

/** Section 9.8 retries: 1 min, 5 min, 30 min, 2 h, 12 h. */
export const OUTGOING_WEBHOOK_RETRY_DELAYS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
] as const;

export const OUTGOING_WEBHOOK_BACKOFF = 'outgoing-webhook';

/**
 * The worker's `settings.backoffStrategy`. BullMQ calls it with the attempts
 * made so far, the failed one included, so the first retry reads index 0.
 * Any other custom type is refused, as BullMQ's own example does.
 */
export function backoffStrategy(attemptsMade: number, type?: string): number {
  if (type !== OUTGOING_WEBHOOK_BACKOFF) throw new Error(`unknown backoff type ${String(type)}`);
  return OUTGOING_WEBHOOK_RETRY_DELAYS[attemptsMade - 1] ?? -1;
}

/**
 * Section 7.3 retries per job. A job the table gives one attempt, or does not
 * list, gets none: `notify.alert`, for one, would repeat an alert to the
 * administrators it already reached.
 */
const RETRIES: Record<string, Pick<JobsOptions, 'attempts' | 'backoff'>> = {
  // 10 attempts, 5 s doubling: the longest wait is 1280 s, inside the 1 h cap.
  'panel.sync-user': { attempts: 10, backoff: { type: 'exponential', delay: 5_000 } },
  'payments.apply-event': { attempts: 5, backoff: { type: 'exponential', delay: 2_000 } },
  'notify.send': { attempts: 3, backoff: { type: 'fixed', delay: 10_000 } },
  'broadcast.chunk': { attempts: 3 },
  // Reads the recipients and writes one delivery each; internal, so like
  // apply-event.
  'webhooks.dispatch': { attempts: 5, backoff: { type: 'exponential', delay: 2_000 } },
  // Section 9.8: the first attempt and five retries.
  'webhooks.deliver': {
    attempts: OUTGOING_WEBHOOK_RETRY_DELAYS.length + 1,
    backoff: { type: OUTGOING_WEBHOOK_BACKOFF },
  },
};

/**
 * Jobs whose `outbox_jobs.job_id` names the latest request rather than one
 * occurrence (section 7.3 "повторная постановка — replace"). A sync reads the
 * user's state when it runs, so a waiting one already covers a new request;
 * one requested while a sync is running runs once more after it. The BullMQ
 * id is then the outbox row: a finished job kept under the shared id would
 * otherwise swallow every later request.
 */
const LATEST_WINS = new Set(['panel.sync-user']);

export function jobOptions(row: { id: string; name: string; jobId: string | null }): JobsOptions {
  const key = toJobId(row.jobId ?? row.id);
  return {
    ...RETRIES[row.name],
    ...(LATEST_WINS.has(row.name)
      ? { jobId: toJobId(row.id), deduplication: { id: key, keepLastIfActive: true } }
      : { jobId: key }),
    removeOnComplete: 1000,
    removeOnFail: 5000,
  };
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
        await queue.add(row.name, row.payload, jobOptions(row));
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
