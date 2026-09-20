import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';

import { RedisSettingsEventBus } from './settings.events';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [
    {
      provide: SettingsRepository,
      inject: [Infrastructure],
      useFactory: (infra: Infrastructure) => new SettingsRepository(infra.db),
    },
    { provide: RedisSettingsEventBus, useFactory: () => new RedisSettingsEventBus() },
    {
      provide: SettingsService,
      inject: [SettingsRepository, RedisSettingsEventBus],
      useFactory: (repository: SettingsRepository, eventBus: RedisSettingsEventBus) =>
        new SettingsService(repository, eventBus),
    },
  ],
  exports: [SettingsService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SettingsModule {}
