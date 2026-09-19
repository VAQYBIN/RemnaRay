import { Module } from '@nestjs/common';

import { createPrismaClient } from '@remnaray/db';

import { RedisSettingsEventBus } from './settings.events';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

const prisma = createPrismaClient();
const repository = new SettingsRepository(prisma);
const eventBus = new RedisSettingsEventBus();

@Module({
  controllers: [SettingsController],
  providers: [
    { provide: SettingsRepository, useValue: repository },
    { provide: RedisSettingsEventBus, useValue: eventBus },
    { provide: SettingsService, useFactory: () => new SettingsService(repository, eventBus) },
  ],
  exports: [SettingsService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SettingsModule {}
