import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import {
  AdminPromocodesController,
  AdminReferralController,
  InternalRewardsController,
} from './rewards.controller';
import { PromocodesService } from './promocodes.service';
import { RewardsService } from './rewards.service';

@Module({
  imports: [SettingsModule],
  controllers: [AdminPromocodesController, AdminReferralController, InternalRewardsController],
  providers: [RewardsService, PromocodesService],
  exports: [RewardsService, PromocodesService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RewardsModule {}
