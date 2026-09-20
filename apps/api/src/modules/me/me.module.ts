import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { RemnawaveModule } from '../remnawave/remnawave.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InternalMeController, MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [SettingsModule, PlansModule, PaymentsModule, SubscriptionsModule, RemnawaveModule],
  controllers: [MeController, InternalMeController],
  providers: [MeService],
  exports: [MeService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MeModule {}
