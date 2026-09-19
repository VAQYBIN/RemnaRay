import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { botCatalogs, SUPPORTED_LOCALES, type Locale } from '@remnaray/i18n-core';

import { Infrastructure } from '../../infra/infra.module';
import { InternalTokenGuard, equalToken } from '../auth/auth.guards';
import { SettingsService } from '../settings/settings.service';

const STREAM_MAX_LENGTH = 10_000;
const publicCommandNames = [
  'start',
  'menu',
  'sub',
  'buy',
  'balance',
  'ref',
  'promo',
  'lang',
  'notifications',
  'help',
  'support',
] as const;
const adminCommandNames = [
  'admin_stats',
  'admin_user',
  'admin_extend',
  'admin_broadcast_status',
] as const;

@Controller('tg/webhook')
export class TelegramWebhookController {
  constructor(
    private readonly infra: Infrastructure,
    private readonly settings: SettingsService,
  ) {}

  @Post(':secretPath')
  @HttpCode(200)
  async receive(
    @Param('secretPath') secretPath: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    const configuredPath = String(await this.settings.get('bot.webhook_secret_path'));
    const configuredToken = String(await this.settings.get('bot.webhook_secret_token'));
    const header = headers['x-telegram-bot-api-secret-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!equalToken(secretPath, configuredPath) || !equalToken(token, configuredToken))
      throw new ForbiddenException('FORBIDDEN');
    await this.infra.redis.xadd(
      'tg:updates',
      'MAXLEN',
      '~',
      STREAM_MAX_LENGTH,
      '*',
      'payload',
      JSON.stringify(body),
    );
    return { ok: true };
  }
}

@Controller('api/internal/v1')
@UseGuards(InternalTokenGuard)
export class BotInternalController {
  constructor(
    private readonly infra: Infrastructure,
    private readonly settings: SettingsService,
  ) {}

  @Get('i18n/:lang')
  messages(@Param('lang') lang: string) {
    const locale = SUPPORTED_LOCALES.includes(lang as Locale) ? (lang as Locale) : 'ru';
    return { lang: locale, messages: botCatalogs[locale] };
  }

  @Get('bot/config')
  async config() {
    const mode = (await this.settings.get('bot.mode')) as 'webhook' | 'polling';
    const domain = String(await this.settings.get('domain.main'));
    const secretPath = String(await this.settings.get('bot.webhook_secret_path'));
    const supportForwardChatId = (await this.settings.get('brand.support_forward_chat_id')) as
      number | null;
    const admins = await this.infra.db.admin.findMany({
      where: { isActive: true, deletedAt: null, telegramId: { not: null } },
      select: { telegramId: true },
    });
    const commands = Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        publicCommandNames.map((command) => ({
          command,
          description: botCatalogs[locale][`bot.commands.${command}`] ?? command,
        })),
      ]),
    );
    const adminCommands = Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        adminCommandNames.map((command) => ({
          command,
          description: botCatalogs[locale][`bot.commands.${command}`] ?? command,
        })),
      ]),
    );
    return {
      mode,
      webhookUrl: `https://${domain}/tg/webhook/${secretPath}`,
      secretPath,
      secretToken: String(await this.settings.get('bot.webhook_secret_token')),
      locales: [...SUPPORTED_LOCALES],
      commands,
      adminCommands,
      supportForwardChatId,
      admins: admins.flatMap((admin) =>
        admin.telegramId === null ? [] : [admin.telegramId.toString()],
      ),
    };
  }
}
