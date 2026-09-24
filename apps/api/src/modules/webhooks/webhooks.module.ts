import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { InternalWebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [SettingsModule],
  controllers: [InternalWebhooksController],
  providers: [WebhooksService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class WebhooksModule {}
