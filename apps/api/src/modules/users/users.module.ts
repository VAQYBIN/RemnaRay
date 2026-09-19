import { Module } from '@nestjs/common';

import { createPrismaClient } from '@remnaray/db';

import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const prisma = createPrismaClient();
const repository = new UsersRepository(prisma);

@Module({
  imports: [SettingsModule],
  controllers: [UsersController],
  providers: [
    { provide: UsersRepository, useValue: repository },
    {
      provide: UsersService,
      inject: [SettingsService],
      useFactory: (settings: SettingsService) => new UsersService(repository, settings),
    },
  ],
  exports: [UsersService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class UsersModule {}
