import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private workers: Array<{ close(): Promise<void> }> = [];
  private queue?: Queue;
  private timer?: ReturnType<typeof setInterval>;

  onModuleInit() {
    if (process.env.RR_WORKER_ENABLED !== 'true') {
      return;
    }

    const connection = {
      host: process.env.RR_VALKEY_HOST ?? '127.0.0.1',
      port: Number(process.env.RR_VALKEY_PORT ?? 6379),
      maxRetriesPerRequest: null,
    };
    this.workers.push(new Worker('maintenance', () => Promise.resolve(undefined), { connection }));
    this.workers.push(
      new Worker(
        'payments',
        async (job: Job<{ eventId?: string }>) => {
          const base = process.env.RR_API_URL ?? 'http://api:3000';
          const token = process.env.RR_INTERNAL_TOKEN ?? '';
          const path =
            job.name === 'payments.apply-event' && job.data.eventId
              ? `/api/internal/v1/payments/events/${job.data.eventId}/apply`
              : job.name === 'payments.poll-pending'
                ? '/api/internal/v1/payments/poll-pending'
                : '/api/internal/v1/payments/expire';
          const response = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'X-Internal-Token': token },
          });
          if (!response.ok) throw new Error(`payment job failed: ${String(response.status)}`);
          return response.json();
        },
        { connection },
      ),
    );
    this.queue = new Queue('payments', { connection });
    let tick = 0;
    this.timer = setInterval(() => {
      tick += 1;
      void this.queue?.add(
        'payments.poll-pending',
        {},
        { jobId: `payments:poll-pending:${String(Date.now())}` },
      );
      if (tick % 2 === 0)
        void this.queue?.add(
          'payments.expire',
          {},
          { jobId: `payments:expire:${String(Date.now())}` },
        );
    }, 30_000);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await Promise.all(this.workers.map((worker) => worker.close()));
    await this.queue?.close();
  }
}
