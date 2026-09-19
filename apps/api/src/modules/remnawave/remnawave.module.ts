import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';
import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import { RemnawaveInternalController, RemnawaveWebhookController } from './remnawave.controller';
import { RemnawaveService } from './remnawave.service';

@Module({
  imports: [SettingsModule],
  controllers: [RemnawaveInternalController, RemnawaveWebhookController],
  providers: [
    {
      provide: RemnawaveService,
      inject: [Infrastructure, SettingsService],
      useFactory: (infra: Infrastructure, settings: SettingsService) =>
        new RemnawaveService(infra, settings),
    },
  ],
  exports: [RemnawaveService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RemnawaveModule {}
