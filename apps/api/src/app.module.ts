import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { HealthController } from './health/health.controller';
import { InfraModule } from './infra/infra.module';
import { AuthModule } from './modules/auth/auth.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PlansModule } from './modules/plans/plans.module';
import { RemnawaveModule } from './modules/remnawave/remnawave.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BotModule } from './modules/bot/bot.module';
import { AdminModule } from './modules/admin/admin.module';
import { PublicModule } from './modules/public/public.module';
import { MeModule } from './modules/me/me.module';
import { AdminApiModule } from './modules/admin-api/admin-api.module';
import { RewardsModule } from './modules/rewards/rewards.module';

@Module({
  imports: [
    InfraModule,
    SettingsModule,
    UsersModule,
    AuthModule,
    LedgerModule,
    PlansModule,
    RemnawaveModule,
    SubscriptionsModule,
    PaymentsModule,
    BotModule,
    AdminModule,
    PublicModule,
    MeModule,
    AdminApiModule,
    RewardsModule,
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
