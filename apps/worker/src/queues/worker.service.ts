import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';

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

  onModuleInit() {
    if (process.env.RR_WORKER_ENABLED !== 'true') return;

    const connection = {
      host: process.env.RR_VALKEY_HOST ?? '127.0.0.1',
      port: Number(process.env.RR_VALKEY_PORT ?? 6379),
      maxRetriesPerRequest: null,
    };

    this.workers.push(
      new Worker(
        'payments',
        async (job: Job<{ eventId?: string }>) => this.call(paymentCall(job)),
        { connection },
      ),
    );
    this.workers.push(
      new Worker(
        'notify',
        async (job: Job<Record<string, unknown>>) => this.call(notifyCall(job)),
        {
          connection,
          concurrency: 1,
        },
      ),
    );
    this.workers.push(
      new Worker(
        'broadcast',
        async (job: Job<Record<string, unknown>>) =>
          this.call({ path: '/api/internal/v1/broadcasts/chunk', body: job.data }),
        { connection, concurrency: 1 },
      ),
    );
    this.workers.push(
      new Worker('panel', async (job: Job<Record<string, unknown>>) => this.call(panelCall(job)), {
        connection,
      }),
    );
    this.workers.push(
      new Worker(
        'maintenance',
        async (job: Job<Record<string, unknown>>) => this.call(maintenanceCall(job)),
        { connection },
      ),
    );

    const payments = new Queue('payments', { connection });
    const notify = new Queue('notify', { connection });
    const maintenance = new Queue('maintenance', { connection });
    this.queues.push(payments, notify, maintenance);

    let tick = 0;
    this.timers.push(
      setInterval(() => {
        tick += 1;
        const stamp = String(Date.now());
        void payments.add('payments.poll-pending', {}, { jobId: `payments:poll-pending:${stamp}` });
        if (tick % 2 === 0)
          void payments.add('payments.expire', {}, { jobId: `payments:expire:${stamp}` });
      }, 30_000),
    );
    // Section 16.1: a ten-minute window is precise enough, and
    // `notification_log` keeps a repeated scan from sending twice.
    this.timers.push(
      setInterval(() => {
        const stamp = String(Date.now());
        void notify.add('notify.scan-expiring', {}, { jobId: `notify:scan-expiring:${stamp}` });
        void maintenance.add(
          'maintenance.referral-release',
          {},
          { jobId: `maintenance:referral-release:${stamp}` },
        );
      }, 10 * 60_000),
    );
  }

  async onModuleDestroy() {
    for (const timer of this.timers) clearInterval(timer);
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(this.queues.map((queue) => queue.close()));
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
