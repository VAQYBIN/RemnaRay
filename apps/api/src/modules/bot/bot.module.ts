import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { InternalTokenGuard } from '../auth/auth.guards';
import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { RemnawaveModule } from '../remnawave/remnawave.module';
import { PublicModule } from '../public/public.module';
import { NotifyModule } from '../notify/notify.module';
import {
  BotInternalController,
  BotAdminController,
  TelegramWebhookController,
} from './bot.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    SettingsModule,
    PaymentsModule,
    PlansModule,
    SubscriptionsModule,
    RemnawaveModule,
    PublicModule,
    NotifyModule,
  ],
  controllers: [TelegramWebhookController, BotInternalController, BotAdminController],
  providers: [InternalTokenGuard, SupportService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BotModule {}
