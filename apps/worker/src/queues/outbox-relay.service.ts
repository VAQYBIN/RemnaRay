import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createPrismaClient, type PrismaClient } from '@remnaray/db';
import { createRedisConnection, OutboxRelay } from '@remnaray/queues';

@Injectable()
export class OutboxRelayService implements OnModuleDestroy {
  private redis?: ReturnType<typeof createRedisConnection>;
  private prisma?: PrismaClient;
  private relay?: OutboxRelay;

  @Cron('*/2 * * * * *')
  async relayOutbox(): Promise<void> {
    if (process.env.RR_WORKER_ENABLED !== 'true') return;
    this.redis ??= createRedisConnection();
    this.prisma ??= createPrismaClient();
    this.relay ??= new OutboxRelay(this.prisma, this.redis);
    await this.relay.runOnce();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.relay) await this.relay.close();
    if (this.redis) await this.redis.quit();
    if (this.prisma) await this.prisma.$disconnect();
  }
}
