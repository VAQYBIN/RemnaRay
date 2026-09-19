import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { InternalTokenGuard } from '../auth/auth.guards';
import { BotInternalController, TelegramWebhookController } from './bot.controller';

@Module({
  imports: [SettingsModule],
  controllers: [TelegramWebhookController, BotInternalController],
  providers: [InternalTokenGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BotModule {}
