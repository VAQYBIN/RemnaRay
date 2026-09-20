import { Global, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient } from '@remnaray/db';
import Redis from 'ioredis';

@Injectable()
export class Infrastructure implements OnModuleDestroy {
  readonly db = createPrismaClient();
  readonly redis = new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  });
  async onModuleDestroy() {
    this.redis.disconnect();
    await this.db.$disconnect();
  }
}
@Global()
@Module({ providers: [Infrastructure], exports: [Infrastructure] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class InfraModule {}
