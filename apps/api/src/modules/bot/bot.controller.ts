import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { botCatalogs, SUPPORTED_LOCALES, type Locale } from '@remnaray/i18n-core';

import { Infrastructure } from '../../infra/infra.module';
import { InternalTokenGuard, equalToken } from '../auth/auth.guards';
import { PaymentsService } from '../payments/payments.service';
import { PlansService } from '../plans/plans.service';
import { SettingsService } from '../settings/settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RemnawaveService, RevokeRateLimitError } from '../remnawave/remnawave.service';

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
    const supportContact = String(await this.settings.get('brand.support_contact'));
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
      supportContact,
      admins: admins.flatMap((admin) =>
        admin.telegramId === null ? [] : [admin.telegramId.toString()],
      ),
    };
  }
}

@Controller('api/internal/v1/me')
@UseGuards(InternalTokenGuard)
export class BotUserController {
  constructor(
    private readonly infra: Infrastructure,
    private readonly settings: SettingsService,
    private readonly plans: PlansService,
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly remnawave: RemnawaveService,
  ) {}

  @Get()
  async me(@Headers('x-acting-user') actingUser: string | undefined) {
    const user = await this.user(actingUser);
    const [account, subscription, purchases] = await Promise.all([
      this.infra.db.account.findFirst({
        where: { kind: 'user', userId: user.id, currency: 'RUB' },
      }),
      this.infra.db.subscription.findFirst({
        where: { userId: user.id, status: { in: ['provisioning', 'active', 'grace'] } },
        orderBy: { expiresAt: 'desc' },
      }),
      this.infra.db.transaction.count({
        where: { userId: user.id, type: 'purchase', amountMinor: { gt: 0n } },
      }),
    ]);
    return {
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        language: user.language,
        referralCode: user.referralCode,
        email: user.email,
        marketingOptOut: user.marketingOptOut,
      },
      balance: { amountMinor: (account?.balanceMinor ?? 0n).toString(), currency: 'RUB' },
      subscription: subscription ? toSubscriptionView(subscription) : null,
      trialAvailable: !user.trialUsedAt && purchases === 0 && !subscription,
    };
  }

  @Patch()
  async patch(@Headers('x-acting-user') actingUser: string | undefined, @Body() body: unknown) {
    const user = await this.user(actingUser);
    if (!isRecord(body)) throw new BadRequestException('INVALID_BODY');
    const data: { language?: string; email?: string | null; marketingOptOut?: boolean } = {};
    if (typeof body.language === 'string' && ['ru', 'en'].includes(body.language))
      data.language = body.language;
    if (body.email === null || typeof body.email === 'string') data.email = body.email;
    if (typeof body.marketingOptOut === 'boolean') data.marketingOptOut = body.marketingOptOut;
    const updated = await this.infra.db.user.update({ where: { id: user.id }, data });
    return {
      language: updated.language,
      email: updated.email,
      marketingOptOut: updated.marketingOptOut,
    };
  }

  @Get('plans')
  plansList() {
    return this.plans.list(false).then((items) => ({ items }));
  }

  @Get('subscription')
  async subscription(@Headers('x-acting-user') actingUser: string | undefined) {
    const user = await this.user(actingUser);
    const [subscription, panelUser] = await Promise.all([
      this.infra.db.subscription.findFirst({
        where: { userId: user.id },
        orderBy: { expiresAt: 'desc' },
      }),
      this.infra.db.panelUser.findUnique({ where: { userId: user.id } }),
    ]);
    return {
      subscription: subscription ? toSubscriptionView(subscription) : null,
      panel: panelUser
        ? {
            status: panelUser.panelStatus,
            usedTrafficBytes: panelUser.usedTrafficBytes.toString(),
            trafficLimitBytes: panelUser.trafficLimitBytes.toString(),
            expireAt: panelUser.expireAtPanel?.toISOString() ?? null,
            deviceLimit: panelUser.hwidDeviceLimit,
            subscriptionUrl: panelUser.subscriptionUrl,
          }
        : null,
    };
  }

  @Get('transactions')
  async transactions(@Headers('x-acting-user') actingUser: string | undefined) {
    const user = await this.user(actingUser);
    const items = await this.infra.db.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        amountMinor: true,
        currency: true,
        status: true,
        createdAt: true,
        reason: true,
      },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        amountMinor: item.amountMinor.toString(),
        currency: item.currency,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        description: item.reason,
      })),
    };
  }

  @Get('referrals')
  async referrals(@Headers('x-acting-user') actingUser: string | undefined) {
    const user = await this.user(actingUser);
    const attributions = await this.infra.db.referralAttribution.findMany({
      where: { referrerId: user.id },
    });
    const [rewards, botUsername] = await Promise.all([
      this.infra.db.referralReward.aggregate({
        where: { attributionId: { in: attributions.map((item) => item.id) } },
        _sum: { amountMinor: true },
      }),
      this.settings.get('bot.username'),
    ]);
    const username = String(botUsername);
    return {
      code: user.referralCode,
      link: `https://t.me/${username}?start=ref_${user.referralCode}`,
      invited: attributions.length,
      converted: attributions.filter((item) => item.status === 'converted').length,
      earned: { amountMinor: (rewards._sum.amountMinor ?? 0n).toString(), currency: 'RUB' },
    };
  }

  @Post('trial')
  @HttpCode(200)
  async trial(@Headers('x-acting-user') actingUser: string | undefined) {
    const user = await this.user(actingUser);
    return { subscription: await this.subscriptions.trial(user.id) };
  }

  @Post('subscription/revoke')
  @HttpCode(200)
  async revoke(@Headers('x-acting-user') actingUser: string | undefined) {
    const user = await this.user(actingUser);
    try {
      return await this.remnawave.revokeSubscription(user.id);
    } catch (error) {
      if (error instanceof RevokeRateLimitError)
        throw new HttpException({ code: 'REVOKE_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
      throw error;
    }
  }

  @Get('payment-methods')
  async paymentMethods() {
    const providers = await this.infra.db.paymentProvider.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, displayName: true },
    });
    return {
      items: [
        {
          code: 'balance',
          displayName: { ru: 'Баланс', en: 'Balance' },
          kind: 'balance',
          available: true,
        },
        ...providers.map((provider) => ({
          code: provider.code,
          displayName: provider.displayName,
          kind: provider.code === 'stars' ? 'stars' : 'redirect',
          available: true,
        })),
      ],
    };
  }

  @Get('topup-config')
  async topupConfig() {
    return {
      presetsMinor: (await this.settings.get('balance.topup_presets_minor')) as string[],
      minMinor: String(await this.settings.get('balance.topup_min_minor')),
      maxMinor: String(await this.settings.get('balance.topup_max_minor')),
    };
  }

  @Post('invoices')
  @HttpCode(201)
  async invoice(
    @Headers('x-acting-user') actingUser: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.user(actingUser);
    if (!isRecord(body) || !isInvoiceKind(body.kind) || typeof body.provider !== 'string')
      throw new BadRequestException('INVALID_BODY');
    const result = await this.payments.createInvoice({
      userId: user.id,
      kind: body.kind,
      provider: body.provider,
      ...(typeof body.planId === 'string' ? { planId: body.planId } : {}),
      ...(typeof body.amountMinor === 'string' ? { amountMinor: BigInt(body.amountMinor) } : {}),
      idempotencyKey: idempotencyKey ?? '',
    });
    if (!result) throw new BadRequestException('INVOICE_NOT_FOUND');
    return toInvoiceView(result);
  }

  @Post('invoices/:id/check')
  @HttpCode(200)
  async check(@Headers('x-acting-user') actingUser: string | undefined, @Param('id') id: string) {
    const user = await this.user(actingUser);
    const invoice = await this.infra.db.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.userId !== user.id) throw new BadRequestException('INVOICE_NOT_FOUND');
    const result = await this.payments.recheck(id);
    if (!result) throw new BadRequestException('INVOICE_NOT_FOUND');
    return toInvoiceView(result);
  }

  private async user(actingUser: string | undefined) {
    if (!actingUser || !/^\d+$/.test(actingUser)) throw new ForbiddenException('FORBIDDEN');
    return this.infra.db.user.findUniqueOrThrow({ where: { telegramId: BigInt(actingUser) } });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInvoiceKind(value: unknown): value is 'purchase' | 'topup' | 'plan_change' {
  return value === 'purchase' || value === 'topup' || value === 'plan_change';
}

function toSubscriptionView(subscription: {
  id: string;
  userId: string;
  planId: string | null;
  source: string;
  status: string;
  startsAt: Date;
  expiresAt: Date;
  trafficLimitBytes: bigint;
  deviceLimit: number;
}) {
  return {
    id: subscription.id,
    userId: subscription.userId,
    planId: subscription.planId,
    source: subscription.source,
    status: subscription.status,
    startsAt: subscription.startsAt.toISOString(),
    expiresAt: subscription.expiresAt.toISOString(),
    trafficLimitBytes: subscription.trafficLimitBytes.toString(),
    deviceLimit: subscription.deviceLimit,
  };
}

function toInvoiceView(invoice: {
  id: string;
  kind: string;
  status: string;
  provider: string;
  amountMinor: bigint;
  currency: string;
  paymentUrl: string | null;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: invoice.id,
    kind: invoice.kind,
    status: invoice.status,
    provider: invoice.provider,
    amount: { amountMinor: invoice.amountMinor.toString(), currency: invoice.currency },
    ...(invoice.paymentUrl ? { paymentUrl: invoice.paymentUrl } : {}),
    expiresAt: invoice.expiresAt.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
  };
}
