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

const appendUpdate = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('XADD', KEYS[1], 'MAXLEN', '~', 10000, '*', 'payload', ARGV[1])
redis.call('SET', KEYS[2], '1', 'EX', 604800)
return 1`;
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
    if (
      !isRecord(body) ||
      typeof body.update_id !== 'number' ||
      !Number.isSafeInteger(body.update_id)
    )
      throw new BadRequestException('INVALID_UPDATE');
    await this.infra.redis.eval(
      appendUpdate,
      2,
      'tg:updates',
      `tg:received:${String(body.update_id)}`,
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

  @Post('users/:telegramId/bot-blocked')
  @HttpCode(204)
  async blocked(@Param('telegramId') telegramId: string) {
    await this.infra.db.user.updateMany({
      where: { telegramId: BigInt(telegramId) },
      data: { botBlockedAt: new Date() },
    });
  }

  @Post('users/:telegramId/bot-unblocked')
  @HttpCode(204)
  async unblocked(@Param('telegramId') telegramId: string) {
    await this.infra.db.user.updateMany({
      where: { telegramId: BigInt(telegramId) },
      data: { botBlockedAt: null },
    });
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
      token: String(await this.settings.get('bot.token')),
      defaultLocale: await this.settings.get('locale.default'),
      webhookUrl: `https://${domain}/tg/webhook/${secretPath}`,
      secretPath,
      secretToken: String(await this.settings.get('bot.webhook_secret_token')),
      locales: await this.settings.get('locale.enabled'),
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

  @Post('promocodes/redeem')
  @HttpCode(200)
  async redeemPromo(
    @Headers('x-acting-user') actingUser: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.user(actingUser);
    if (
      !isRecord(body) ||
      typeof body.code !== 'string' ||
      !/^[A-Za-z0-9_-]{3,64}$/u.test(body.code)
    )
      throw new BadRequestException('INVALID_BODY');
    const promo = await this.infra.db.promocode.findFirst({
      where: { code: { equals: body.code, mode: 'insensitive' }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!promo) throw new BadRequestException('PROMO_NOT_FOUND');
    await this.infra.db.user.update({
      where: { id: user.id },
      data: { pendingPromocodeId: promo.id },
    });
    return { reservedForNextPurchase: true };
  }

  @Post('support/forward')
  @HttpCode(204)
  async supportForward(
    @Headers('x-acting-user') actingUser: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.user(actingUser);
    if (
      !isRecord(body) ||
      typeof body.text !== 'string' ||
      body.text.length < 1 ||
      body.text.length > 4000
    )
      throw new BadRequestException('INVALID_BODY');
    const chatId = await this.settings.get('brand.support_forward_chat_id');
    const token = await this.settings.get('bot.token');
    if (typeof chatId !== 'number' || typeof token !== 'string' || !token) return;
    const response = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          chat_id: chatId,
          text: `#support ${user.telegramId.toString()}\n${body.text}`,
        }),
      },
    );
    if (!response.ok) throw new BadRequestException('SUPPORT_UNAVAILABLE');
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

@Controller('api/internal/v1/admins')
@UseGuards(InternalTokenGuard)
export class BotAdminController {
  constructor(private readonly infra: Infrastructure) {}

  @Get('by-telegram/:id')
  async byTelegram(@Param('id') id: string) {
    const admin = await this.infra.db.admin.findFirst({
      where: { telegramId: BigInt(id), isActive: true, deletedAt: null },
      select: { role: true },
    });
    if (!admin) throw new BadRequestException('ADMIN_NOT_FOUND');
    return { role: admin.role };
  }

  @Get('stats')
  async stats(@Headers('x-acting-user') actingUser: string | undefined) {
    await this.authorize(actingUser);
    const [users, active, today] = await Promise.all([
      this.infra.db.user.count(),
      this.infra.db.subscription.count({ where: { status: 'active' } }),
      this.infra.db.transaction.count({ where: { createdAt: { gte: startOfDay() } } }),
    ]);
    return { users, activeSubscriptions: active, transactionsToday: today };
  }

  @Get('users/:query')
  async user(
    @Headers('x-acting-user') actingUser: string | undefined,
    @Param('query') query: string,
  ) {
    await this.authorize(actingUser);
    const user = await this.infra.db.user.findFirst({
      where: /^\d+$/.test(query)
        ? { telegramId: BigInt(query) }
        : { username: { equals: query.replace(/^@/u, ''), mode: 'insensitive' } },
      select: { id: true, telegramId: true, username: true, firstName: true, language: true },
    });
    if (!user) throw new BadRequestException('USER_NOT_FOUND');
    return { ...user, telegramId: user.telegramId.toString() };
  }

  @Post('extend')
  @HttpCode(200)
  async extend(@Headers('x-acting-user') actingUser: string | undefined, @Body() body: unknown) {
    const admin = await this.authorize(actingUser);
    if (
      !isRecord(body) ||
      typeof body.telegramId !== 'string' ||
      !/^\d+$/.test(body.telegramId) ||
      typeof body.days !== 'number' ||
      !Number.isInteger(body.days) ||
      body.days < 1 ||
      body.days > 3650
    )
      throw new BadRequestException('INVALID_BODY');
    const user = await this.infra.db.user.findUnique({
      where: { telegramId: BigInt(body.telegramId) },
    });
    if (!user) throw new BadRequestException('USER_NOT_FOUND');
    const subscription = await this.infra.db.subscription.findFirst({
      where: { userId: user.id, status: { in: ['provisioning', 'active', 'grace'] } },
      orderBy: { expiresAt: 'desc' },
    });
    if (!subscription) throw new BadRequestException('SUBSCRIPTION_NOT_FOUND');
    const before = { expiresAt: subscription.expiresAt.toISOString() };
    const afterDate = new Date(subscription.expiresAt.getTime() + body.days * 86_400_000);
    await this.infra.db.$transaction(async (transaction) => {
      await transaction.subscription.update({
        where: { id: subscription.id },
        data: { expiresAt: afterDate },
      });
      await transaction.transaction.create({
        data: {
          userId: user.id,
          type: 'adjustment',
          status: 'completed',
          amountMinor: 0n,
          currency: 'RUB',
          reason: 'bot-admin',
          actorAdminId: admin.id,
          subscriptionId: subscription.id,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorAdminId: admin.id,
          actorType: 'admin',
          action: 'subscription.extend',
          entity: 'subscription',
          entityId: subscription.id,
          before,
          after: { expiresAt: afterDate.toISOString(), days: Number(body.days) },
          reason: 'bot-admin',
        },
      });
    });
    return { expiresAt: afterDate.toISOString(), days: body.days };
  }

  @Get('broadcast-status')
  async broadcastStatus(@Headers('x-acting-user') actingUser: string | undefined) {
    await this.authorize(actingUser);
    const broadcast = await this.infra.db.broadcast.findFirst({ orderBy: { createdAt: 'desc' } });
    return broadcast
      ? {
          id: broadcast.id,
          status: broadcast.status,
          sent: broadcast.sentCount,
          total: broadcast.totalCount,
        }
      : null;
  }

  private async authorize(actingUser: string | undefined) {
    if (!actingUser || !/^\d+$/.test(actingUser)) throw new ForbiddenException('FORBIDDEN');
    const admin = await this.infra.db.admin.findFirst({
      where: {
        telegramId: BigInt(actingUser),
        isActive: true,
        deletedAt: null,
        role: { in: ['admin', 'operator'] },
      },
    });
    if (!admin) throw new ForbiddenException('FORBIDDEN');
    return admin;
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

function startOfDay(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
