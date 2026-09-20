import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { NotifyModule } from '../notify/notify.module';
import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { PublicModule } from '../public/public.module';
import { SettingsModule } from '../settings/settings.module';
import { SetupController } from './setup.controller';
import { SetupGuard } from './setup.guard';
import { SetupService } from './setup.service';

@Module({
  imports: [SettingsModule, PlansModule, PublicModule, PaymentsModule, NotifyModule],
  controllers: [SetupController],
  providers: [SetupService, { provide: APP_GUARD, useClass: SetupGuard }],
  exports: [SetupService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SetupModule {}
