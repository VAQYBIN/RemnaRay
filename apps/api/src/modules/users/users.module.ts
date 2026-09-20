import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';

import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import { InternalTokenGuard } from '../auth/auth.guards';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { RewardsModule } from '../rewards/rewards.module';
import { RewardsService } from '../rewards/rewards.service';

@Module({
  imports: [SettingsModule, RewardsModule],
  controllers: [UsersController],
  providers: [
    InternalTokenGuard,
    {
      provide: UsersRepository,
      inject: [Infrastructure],
      useFactory: (infra: Infrastructure) => new UsersRepository(infra.db),
    },
    {
      provide: UsersService,
      inject: [UsersRepository, SettingsService, RewardsService],
      useFactory: (
        repository: UsersRepository,
        settings: SettingsService,
        rewards: RewardsService,
      ) => new UsersService(repository, settings, rewards),
    },
  ],
  exports: [UsersService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class UsersModule {}
