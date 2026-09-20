import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { AdminBroadcastsController, InternalBroadcastsController } from './broadcasts.controller';
import { BroadcastsService } from './broadcasts.service';

@Module({
  imports: [SettingsModule],
  controllers: [AdminBroadcastsController, InternalBroadcastsController],
  providers: [BroadcastsService],
  exports: [BroadcastsService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BroadcastsModule {}
