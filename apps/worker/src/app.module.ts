import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';

import { HealthController } from './health/health.controller';
import { MetricsController } from './health/metrics.controller';
import { WorkerService } from './queues/worker.service';
import { OutboxRelayService } from './queues/outbox-relay.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.RR_LOG_LEVEL ?? 'info',
      },
    }),
  ],
  controllers: [HealthController, MetricsController],
  providers: [WorkerService, OutboxRelayService],
})
// Nest module metadata is intentionally the complete shell for this milestone.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
