import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: { close(): Promise<void> };

  onModuleInit() {
    if (process.env.RR_WORKER_ENABLED !== 'true') {
      return;
    }

    this.worker = new Worker('maintenance', () => Promise.resolve(undefined), {
      connection: {
        host: process.env.RR_VALKEY_HOST ?? '127.0.0.1',
        port: Number(process.env.RR_VALKEY_PORT ?? 6379),
        maxRetriesPerRequest: null,
      },
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
