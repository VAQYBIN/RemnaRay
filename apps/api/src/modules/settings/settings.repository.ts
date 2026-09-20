import type { PrismaClient } from '@remnaray/db';

export type StoredSetting = {
  key: string;
  value: unknown;
  isSecret: boolean;
};

export type SettingWrite = StoredSetting;

export interface SettingsRepositoryPort {
  list(): Promise<StoredSetting[]>;
  replace(values: SettingWrite[], actorId?: string): Promise<void>;
}

export class SettingsRepository implements SettingsRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<StoredSetting[]> {
    return this.prisma.setting.findMany({
      select: { key: true, value: true, isSecret: true },
    });
  }

  async replace(values: SettingWrite[], actorId?: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      for (const value of values) {
        await transaction.setting.upsert({
          where: { key: value.key },
          create: {
            key: value.key,
            value: value.value as never,
            isSecret: value.isSecret,
            updatedBy: actorId ?? null,
          },
          update: {
            value: value.value as never,
            isSecret: value.isSecret,
            updatedBy: actorId ?? null,
          },
        });
      }
    });
  }
}
