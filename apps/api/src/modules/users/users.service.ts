import { Injectable, Optional } from '@nestjs/common';

import { RewardsService } from '../rewards/rewards.service';
import { SettingsService } from '../settings/settings.service';
import { parseStartPayload, userUpsertSchema } from './users.schemas';
import type { UsersRepositoryPort, UserUpsertResult } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepositoryPort,
    private readonly settings: SettingsService,
    @Optional() private readonly rewards?: RewardsService,
  ) {}

  async upsert(value: unknown): Promise<UserUpsertResult> {
    const input = userUpsertSchema.parse(value);
    const configuredLanguage = await this.settings.get('locale.default');
    const defaultLanguage = configuredLanguage === 'en' ? configuredLanguage : 'ru';
    const result = await this.repository.upsert(
      input,
      parseStartPayload(input.startPayload),
      defaultLanguage,
    );
    // Section 15.2: the `signup` trigger grants the invitee bonus as soon as the
    // attribution exists, before any payment.
    if (result.attributed) await this.rewards?.grantSignupBonus(result.user.id);
    return result;
  }
}
