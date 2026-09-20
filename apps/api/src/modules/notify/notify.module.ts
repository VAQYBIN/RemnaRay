import { Module } from '@nestjs/common';

import { PublicModule } from '../public/public.module';
import { SettingsModule } from '../settings/settings.module';
import { InternalNotifyController } from './notify.controller';
import { NotifyService } from './notify.service';

@Module({
  imports: [SettingsModule, PublicModule],
  controllers: [InternalNotifyController],
  providers: [NotifyService],
  exports: [NotifyService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class NotifyModule {}
