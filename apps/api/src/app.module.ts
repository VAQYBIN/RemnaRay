import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { HealthController } from './health/health.controller';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    SettingsModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.RR_LOG_LEVEL ?? 'info',
      },
    }),
  ],
  controllers: [HealthController],
})
// Nest module metadata is intentionally the complete shell for this milestone.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
