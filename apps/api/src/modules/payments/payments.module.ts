import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';
import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import { RewardsModule } from '../rewards/rewards.module';
import { RewardsService } from '../rewards/rewards.service';
import {
  PaymentsInternalController,
  PaymentsWebhookController,
  StarsInternalController,
} from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderRegistry, createPaymentProviderRegistry } from './payments.registry';
import { PaymentsService } from './payments.service';
import { StarsService } from './stars.service';

@Module({
  imports: [SettingsModule, RewardsModule],
  controllers: [PaymentsWebhookController, PaymentsInternalController, StarsInternalController],
  providers: [
    {
      provide: PaymentProviderRegistry,
      inject: [],
      useFactory: () => createPaymentProviderRegistry(),
    },
    {
      provide: PaymentsRepository,
      inject: [Infrastructure, RewardsService],
      useFactory: (infra: Infrastructure, rewards: RewardsService) =>
        new PaymentsRepository(infra.db, rewards),
    },
    {
      provide: PaymentsService,
      inject: [Infrastructure, PaymentsRepository, PaymentProviderRegistry, SettingsService],
      useFactory: (
        infra: Infrastructure,
        repository: PaymentsRepository,
        providers: PaymentProviderRegistry,
        settings: SettingsService,
      ) => new PaymentsService(infra, repository, providers, settings),
    },
    {
      provide: StarsService,
      inject: [Infrastructure, PaymentsRepository],
      useFactory: (infra: Infrastructure, repository: PaymentsRepository) =>
        new StarsService(infra, repository),
    },
  ],
  exports: [PaymentsService, PaymentProviderRegistry],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PaymentsModule {}
