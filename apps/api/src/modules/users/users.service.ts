import { Injectable } from '@nestjs/common';

import { SettingsService } from '../settings/settings.service';
import { parseStartPayload, userUpsertSchema } from './users.schemas';
import type { UsersRepositoryPort, UserUpsertResult } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepositoryPort,
    private readonly settings: SettingsService,
  ) {}

  async upsert(value: unknown): Promise<UserUpsertResult> {
    const input = userUpsertSchema.parse(value);
    const configuredLanguage = await this.settings.get('locale.default');
    const defaultLanguage = configuredLanguage === 'en' ? configuredLanguage : 'ru';
    return this.repository.upsert(input, parseStartPayload(input.startPayload), defaultLanguage);
  }
}
