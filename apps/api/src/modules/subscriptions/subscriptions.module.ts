import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';
import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import {
  InternalSubscriptionsController,
  UserSubscriptionsController,
} from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [SettingsModule],
  controllers: [UserSubscriptionsController, InternalSubscriptionsController],
  providers: [
    {
      provide: SubscriptionsRepository,
      inject: [Infrastructure],
      useFactory: (infra: Infrastructure) => new SubscriptionsRepository(infra.db),
    },
    {
      provide: SubscriptionsService,
      inject: [SubscriptionsRepository, SettingsService],
      useFactory: (repository: SubscriptionsRepository, settings: SettingsService) =>
        new SubscriptionsService(repository, settings),
    },
  ],
  exports: [SubscriptionsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SubscriptionsModule {}
