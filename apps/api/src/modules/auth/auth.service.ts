import { Injectable } from '@nestjs/common';

import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import { verifyJwt, verifyTelegramWidget, signJwt, AuthFailure } from './auth.crypto';
import { issueTokenSchema, telegramWidgetSchema, type TelegramWidgetInput } from './auth.schemas';
import type { SessionStorePort } from './auth.session';

@Injectable()
export class AuthService {
  constructor(
    private readonly settings: SettingsService,
    private readonly users: UsersService,
    private readonly sessions: SessionStorePort,
    private readonly appKey: string,
  ) {}

  /**
   * Section 15.3: the `rr_ref` cookie set by `/r/<code>` attributes a user who
   * signs in on the site, using the same start payload the bot would send.
   */
  async authenticateTelegram(
    value: unknown,
    requestMeta?: { userAgent?: string; ip?: string; referralCode?: string },
  ) {
    const input = telegramWidgetSchema.parse(value);
    const botToken = await this.settings.get('bot.token');
    if (typeof botToken !== 'string' || !botToken) throw new AuthFailure('AUTH_UNAVAILABLE');
    verifyTelegramWidget(input, botToken);
    const user = await this.users.upsert({
      telegramId: String(input.id),
      firstName: input.first_name,
      ...(input.username ? { username: input.username } : {}),
      ...(input.language_code ? { languageCode: input.language_code } : {}),
      ...(requestMeta?.referralCode ? { startPayload: `ref_${requestMeta.referralCode}` } : {}),
    });
    const sessionId = await this.sessions.create({
      userId: user.user.id,
      user: user.user,
      ...(requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : {}),
      ...(requestMeta?.ip ? { ip: requestMeta.ip } : {}),
    });
    return { user: user.user, sessionId };
  }

  async issueBotToken(value: unknown) {
    const input = issueTokenSchema.parse(value);
    const user = await this.users.upsert({ telegramId: String(input.telegramId) });
    return { token: signJwt(user.user.id, this.appKey), user: user.user };
  }

  async exchangeJwt(token: string): Promise<string> {
    const claims = verifyJwt(token, this.appKey);
    return this.sessions.create({ userId: claims.sub });
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (sessionId) await this.sessions.delete(sessionId);
  }

  me(userId: string | undefined) {
    return { userId };
  }
}

export function asTelegramWidgetInput(value: unknown): TelegramWidgetInput {
  return telegramWidgetSchema.parse(value);
}
