import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { queueJobs, recordTlsExpiry } from '@remnaray/metrics';
import { createRedisConnection, QUEUE_PREFIX, toJobId, type QueueName } from '@remnaray/queues';
import { Queue, Worker, type Job } from 'bullmq';

import { backupStatus } from './backup-check';
import { cronJobs } from './schedule';
import { certificateStatus } from './tls-check';
import { workerValkeyUrl } from './worker-config';

type InternalCall = { path: string; body?: unknown };

/**
 * Section 7.3 queue consumers. The worker owns no domain logic: it calls the
 * internal API, which holds the transactional boundaries.
 */
@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private workers: { close(): Promise<void> }[] = [];
  private queues: Queue[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];
  private redis?: ReturnType<typeof createRedisConnection>;

  async onModuleInit(): Promise<void> {
    this.redis = createRedisConnection(workerValkeyUrl());
    await this.redis.ping();
    const connection = this.redis;
    // The prefix the outbox relay publishes under. Without it the workers wait
    // on `bull:*` while every relayed job sits in `rr:q:*` for ever.
    const options = { connection, prefix: QUEUE_PREFIX };

    this.workers.push(
      new Worker(
        'payments',
        async (job: Job<{ eventId?: string }>) => this.call(paymentCall(job)),
        options,
      ),
    );
    this.workers.push(
      new Worker(
        'notify',
        async (job: Job<Record<string, unknown>>) => this.call(notifyCall(job)),
        { ...options, concurrency: 1 },
      ),
    );
    this.workers.push(
      new Worker(
        'broadcast',
        async (job: Job<Record<string, unknown>>) =>
          this.call({ path: '/api/internal/v1/broadcasts/chunk', body: job.data }),
        { ...options, concurrency: 1 },
      ),
    );
    this.workers.push(
      new Worker(
        'panel',
        async (job: Job<Record<string, unknown>>) => this.call(panelCall(job)),
        options,
      ),
    );
    this.workers.push(
      new Worker(
        'maintenance',
        async (job: Job<Record<string, unknown>>) =>
          job.name === 'maintenance.tls-check'
            ? await this.tlsCheck()
            : job.name === 'maintenance.backup-check'
              ? await this.backupCheck()
              : await this.call(maintenanceCall(job)),
        options,
      ),
    );

    const payments = new Queue('payments', options);
    const notify = new Queue('notify', options);
    const maintenance = new Queue('maintenance', options);
    const panel = new Queue('panel', options);
    // Counted, not consumed from here: section 9.9 wants every queue's depth,
    // and a queue the worker only reads counts is cheap to hold open.
    const counted = [payments, notify, maintenance, new Queue('broadcast', options), panel];
    this.queues.push(...counted);

    // Section 9.9 `rr_queue_jobs{queue,state}`. A gauge, sampled: BullMQ keeps
    // the counts in Valkey and asking on every scrape would make the scrape
    // the load.
    const sampleQueues = () => {
      for (const queue of counted)
        void queue
          .getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed')
          .then((counts) => {
            for (const [state, value] of Object.entries(counts))
              queueJobs.set({ queue: queue.name, state }, value);
          })
          .catch(() => undefined);
    };
    sampleQueues();
    this.timers.push(setInterval(sampleQueues, 15_000));

    let tick = 0;
    this.timers.push(
      setInterval(() => {
        tick += 1;
        const stamp = String(Date.now());
        void payments.add(
          'payments.poll-pending',
          {},
          { jobId: toJobId(`payments:poll-pending:${stamp}`) },
        );
        if (tick % 2 === 0)
          void payments.add('payments.expire', {}, { jobId: toJobId(`payments:expire:${stamp}`) });
      }, 30_000),
    );
    // Section 16.1: a ten-minute window is precise enough, and
    // `notification_log` keeps a repeated scan from sending twice.
    this.timers.push(
      setInterval(() => {
        const stamp = String(Date.now());
        void notify.add(
          'notify.scan-expiring',
          {},
          { jobId: toJobId(`notify:scan-expiring:${stamp}`) },
        );
        void maintenance.add(
          'maintenance.referral-release',
          {},
          { jobId: toJobId(`maintenance:referral-release:${stamp}`) },
        );
      }, 10 * 60_000),
    );
    // Section 7.3 minute and quarter-hour crons. A finished job is kept past
    // its fifteen-minute slot: BullMQ ignores an id only while the job
    // exists, and the kept id is what makes the slot run once.
    const byName: Partial<Record<QueueName, Queue>> = { maintenance, panel };
    const queueCron = () => {
      for (const job of cronJobs(new Date()))
        void byName[job.queue]
          ?.add(
            job.name,
            {},
            {
              jobId: toJobId(job.jobId),
              removeOnComplete: { age: 24 * 60 * 60 },
              removeOnFail: { age: 7 * 24 * 60 * 60 },
            },
          )
          .catch((error: unknown) => {
            this.logger.warn(`${job.name} was not queued: ${String(error)}`);
          });
    };
    queueCron();
    this.timers.push(setInterval(queueCron, 60_000));
    // Section 19.2: the certificate is checked at start and once a day.
    // Section 20.3: the same daily cadence for the backup status.
    const queueDaily = () => {
      const stamp = String(Date.now());
      void maintenance.add(
        'maintenance.tls-check',
        {},
        { jobId: toJobId(`maintenance:tls-check:${stamp}`) },
      );
      void maintenance.add(
        'maintenance.backup-check',
        {},
        { jobId: toJobId(`maintenance:backup-check:${stamp}`) },
      );
    };
    queueDaily();
    this.timers.push(setInterval(queueDaily, 24 * 60 * 60_000));
  }

  /**
   * The only maintenance job the worker performs itself: section 19.2 wants the
   * TLS handshake made from outside the API, and the result is reported back so
   * the alert and the `/admin/system` reading stay in one place.
   */
  private async tlsCheck(): Promise<unknown> {
    const domain = process.env.RR_DOMAIN ?? '';
    if (!domain) return { skipped: 'RR_DOMAIN is not set' };
    const [host, port] = domain.split(':');
    const status = await certificateStatus(host ?? domain, port ? Number(port) : 443);
    recordTlsExpiry(status.expiresAt);
    return this.call({ path: '/api/internal/v1/system/tls-result', body: status });
  }

  /** Section 20.3: `.last-status` is written by the `backup` container. */
  private async backupCheck(): Promise<unknown> {
    return this.call({
      path: '/api/internal/v1/system/backup-result',
      body: backupStatus(process.env.RR_BACKUP_DIR ?? '/backups'),
    });
  }

  async onModuleDestroy() {
    for (const timer of this.timers) clearInterval(timer);
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(this.queues.map((queue) => queue.close()));
    if (this.redis) await this.redis.quit();
  }

  private async call({ path, body }: InternalCall): Promise<unknown> {
    const base = process.env.RR_API_URL ?? 'http://api:3000';
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'X-Internal-Token': process.env.RR_INTERNAL_TOKEN ?? '',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      signal: AbortSignal.timeout(30_000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`${path} failed with ${String(response.status)}`);
      throw new Error(`job failed: ${String(response.status)} ${text.slice(0, 200)}`);
    }
    return response.json();
  }
}

function paymentCall(job: Job<{ eventId?: string }>): InternalCall {
  if (job.name === 'payments.apply-event' && job.data.eventId)
    return { path: `/api/internal/v1/payments/events/${job.data.eventId}/apply` };
  if (job.name === 'payments.poll-pending')
    return { path: '/api/internal/v1/payments/poll-pending' };
  return { path: '/api/internal/v1/payments/expire' };
}

function notifyCall(job: Job<Record<string, unknown>>): InternalCall {
  if (job.name === 'notify.alert') return { path: '/api/internal/v1/notify/alert', body: job.data };
  if (job.name === 'notify.scan-expiring') return { path: '/api/internal/v1/notify/scan-expiring' };
  return { path: '/api/internal/v1/notify/send', body: job.data };
}

function panelCall(job: Job<Record<string, unknown>>): InternalCall {
  if (job.name === 'panel.sync-user')
    return { path: '/api/internal/v1/remnawave/sync-user', body: job.data };
  return { path: '/api/internal/v1/remnawave/reconcile' };
}

function maintenanceCall(job: Job<Record<string, unknown>>): InternalCall {
  if (job.name === 'maintenance.referral-release')
    return { path: '/api/internal/v1/rewards/release-held' };
  return { path: '/api/internal/v1/subscriptions/expire' };
}
