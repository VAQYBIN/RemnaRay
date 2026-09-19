import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { HealthController } from './health/health.controller';
import { InfraModule } from './infra/infra.module';
import { AuthModule } from './modules/auth/auth.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PlansModule } from './modules/plans/plans.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    InfraModule,
    SettingsModule,
    UsersModule,
    AuthModule,
    LedgerModule,
    PlansModule,
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
