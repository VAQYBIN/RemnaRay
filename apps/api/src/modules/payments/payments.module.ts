import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';
import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import { MockPaymentProvider } from '@remnaray/payments-mock';
import {
  BalanceProvider,
  CryptoBotProvider,
  LavaProvider,
  PlategaProvider,
  RobokassaProvider,
  StarsProvider,
  YooKassaProvider,
} from './builtin-providers';
import {
  PaymentsInternalController,
  PaymentsUserController,
  PaymentsWebhookController,
} from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderRegistry } from './payments.registry';
import { PaymentsService } from './payments.service';

@Module({
  imports: [SettingsModule],
  controllers: [PaymentsWebhookController, PaymentsUserController, PaymentsInternalController],
  providers: [
    {
      provide: PaymentProviderRegistry,
      inject: [],
      useFactory: () => {
        const registry = new PaymentProviderRegistry();
        for (const provider of [
          new MockPaymentProvider(),
          new YooKassaProvider(),
          new RobokassaProvider(),
          new LavaProvider(),
          new PlategaProvider(),
          new CryptoBotProvider(),
          new StarsProvider(),
          new BalanceProvider(),
        ])
          registry.register(provider);
        return registry;
      },
    },
    {
      provide: PaymentsRepository,
      inject: [Infrastructure],
      useFactory: (infra: Infrastructure) => new PaymentsRepository(infra.db),
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
  ],
  exports: [PaymentsService, PaymentProviderRegistry],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PaymentsModule {}
