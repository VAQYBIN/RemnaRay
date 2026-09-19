import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { InternalTokenGuard } from '../auth/auth.guards';
import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { RemnawaveModule } from '../remnawave/remnawave.module';
import {
  BotInternalController,
  BotUserController,
  TelegramWebhookController,
} from './bot.controller';

@Module({
  imports: [SettingsModule, PaymentsModule, PlansModule, SubscriptionsModule, RemnawaveModule],
  controllers: [TelegramWebhookController, BotInternalController, BotUserController],
  providers: [InternalTokenGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BotModule {}
