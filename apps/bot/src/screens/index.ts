import { randomUUID } from 'node:crypto';
import { InlineKeyboard, type Bot } from 'grammy';

import { ApiClientError, type ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { showHome, showTrialConfirm } from './home.js';
import { createPayment, checkPayment } from './payments.js';
import { showPlan, showPlans } from './plans.js';
import { showSubscription, showClients, showQr, confirmRevoke } from './subscription.js';
import { backButton, formatMinor, show } from './common.js';

export function registerScreens(bot: Bot<RrContext>, api: ApiClient): void {
  bot.command('start', (ctx) => showHome(ctx, api));
  bot.command('menu', (ctx) => showHome(ctx, api));
  bot.command('buy', (ctx) => showPlans(ctx, api));
  bot.command('sub', (ctx) => showSubscription(ctx, api));
  bot.command('promo', (ctx) => ctx.conversation.enter('promoEnter'));
  bot.callbackQuery('promo:enter', (ctx) => ctx.conversation.enter('promoEnter'));
  bot.callbackQuery('topup:custom', (ctx) => ctx.conversation.enter('topupCustom'));
  bot.command('balance', (ctx) => showBalance(ctx, api));
  bot.command('ref', (ctx) => showReferrals(ctx, api));
  bot.command('lang', (ctx) => showLanguage(ctx));
  bot.command('notifications', (ctx) => showNotifications(ctx, api));
  bot.command('help', (ctx) => show(ctx, ctx.t('bot.screen.help.text'), backButton(ctx)));
  bot.command('support', (ctx) => ctx.conversation.enter('supportMessage'));
  bot.command('admin_stats', (ctx) => adminStats(ctx, api));
  bot.command('admin_user', (ctx) => adminUser(ctx, api));
  bot.command('admin_extend', (ctx) => adminExtend(ctx, api));
  bot.command('admin_broadcast_status', (ctx) => adminBroadcastStatus(ctx, api));
  bot.callbackQuery('home', (ctx) => showHome(ctx, api));
  bot.callbackQuery('profile', (ctx) => showHome(ctx, api));
  bot.callbackQuery('plans', (ctx) => showPlans(ctx, api));
  bot.callbackQuery('sub', (ctx) => showSubscription(ctx, api));
  bot.callbackQuery('sub:clients', (ctx) => showClients(ctx, api));
  bot.callbackQuery('sub:qr', (ctx) => showQr(ctx, api));
  bot.callbackQuery('sub:revoke', (ctx) => confirmRevoke(ctx));
  bot.callbackQuery('sub:revoke:go', async (ctx) => {
    try {
      await api.revokeSubscription(ctx.from.id);
      await showSubscription(ctx, api);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'REVOKE_RATE_LIMITED')
        await show(ctx, ctx.t('bot.error.revoke_rate_limited'), backButton(ctx, 'sub'));
      else throw error;
    }
  });
  bot.callbackQuery(/^plan:([a-z0-9_-]+)$/u, (ctx) => showPlan(ctx, api, capture(ctx.match, 1)));
  bot.callbackQuery(/^pay:([a-z0-9_-]+):([a-z-]+)$/u, (ctx) =>
    createPayment(ctx, api, capture(ctx.match, 1), capture(ctx.match, 2)),
  );
  bot.callbackQuery(/^inv:check:([0-9a-f-]+)$/u, (ctx) =>
    checkPayment(ctx, api, capture(ctx.match, 1)),
  );
  bot.callbackQuery('trial:confirm', (ctx) => showTrialConfirm(ctx));
  bot.callbackQuery('trial:go', async (ctx) => {
    await api.startTrial(ctx.from.id);
    await showSubscription(ctx, api);
  });
  bot.callbackQuery('balance', (ctx) => showBalance(ctx, api));
  bot.callbackQuery('topup:open', (ctx) => showTopup(ctx, api));
  bot.callbackQuery(/^topup:(\d+):([a-z-]+)$/u, (ctx) =>
    createTopup(ctx, api, capture(ctx.match, 1), capture(ctx.match, 2)),
  );
  bot.callbackQuery('ref', (ctx) => showReferrals(ctx, api));
  bot.callbackQuery('lang', (ctx) => showLanguage(ctx));
  bot.callbackQuery(/^lang:(ru|en)$/u, (ctx) =>
    setLanguage(ctx, api, capture(ctx.match, 1) as 'ru' | 'en'),
  );
  bot.callbackQuery('support', (ctx) => ctx.conversation.enter('supportMessage'));
  bot.callbackQuery('notif:toggle', (ctx) => toggleNotifications(ctx, api));
  bot.callbackQuery('email:ask', (ctx) =>
    show(ctx, ctx.t('bot.screen.email.ask'), backButton(ctx)),
  );
}

async function showBalance(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const [state, transactions] = await Promise.all([
    api.getMe(ctx.from.id),
    api.getTransactions(ctx.from.id),
  ]);
  const recent = transactions.items
    .map(
      (item) =>
        `${formatMinor(item.amountMinor, item.currency)} · ${item.description ?? item.createdAt}`,
    )
    .join('\n');
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.btn.topup'), 'topup:open')
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  await show(
    ctx,
    `${ctx.t('bot.screen.balance.details', { balance: formatMinor(state.balance.amountMinor, state.balance.currency) })}\n${recent}`,
    keyboard,
  );
}

async function showTopup(ctx: RrContext, api: ApiClient): Promise<void> {
  const [config, methods] = await Promise.all([api.getTopupConfig(), api.getPaymentMethods()]);
  const provider = methods.items.find((item) => item.available && item.kind !== 'balance')?.code;
  const keyboard = new InlineKeyboard();
  for (const amount of config.presetsMinor) {
    keyboard
      .text(formatMinor(amount), provider ? `topup:${amount}:${provider}` : 'topup:custom')
      .row();
  }
  keyboard.text(ctx.t('bot.btn.back'), 'balance');
  await show(ctx, ctx.t('bot.screen.topup.title'), keyboard);
}

async function createTopup(
  ctx: RrContext,
  api: ApiClient,
  amountMinor: string,
  provider: string,
): Promise<void> {
  if (!ctx.from) return;
  const invoice = await api.createInvoice(
    ctx.from.id,
    { kind: 'topup', provider, amountMinor },
    randomUUID(),
  );
  ctx.session.lastInvoiceId = invoice.id;
  await show(
    ctx,
    ctx.t('bot.screen.pay.wait', { price: formatMinor(amountMinor), until: invoice.expiresAt }),
    backButton(ctx),
  );
}

async function showReferrals(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const state = await api.getReferrals(ctx.from.id);
  await show(ctx, ctx.t('bot.screen.ref.details', state), backButton(ctx));
}

async function showLanguage(ctx: RrContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.lang.ru'), 'lang:ru')
    .text(ctx.t('bot.lang.en'), 'lang:en')
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  await show(ctx, ctx.t('bot.screen.lang.title'), keyboard);
}

async function setLanguage(ctx: RrContext, api: ApiClient, language: 'ru' | 'en'): Promise<void> {
  if (!ctx.from) return;
  await api.patchMe(ctx.from.id, { language });
  ctx.session.lang = language;
  ctx.locale = language;
  await showHome(ctx, api);
}

async function showNotifications(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const state = await api.getMe(ctx.from.id);
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.screen.notifications.enabled'), 'notif:toggle')
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  await show(
    ctx,
    ctx.t(
      state.user.marketingOptOut
        ? 'bot.screen.notifications.disabled'
        : 'bot.screen.notifications.enabled',
    ),
    keyboard,
  );
}

async function toggleNotifications(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const state = await api.getMe(ctx.from.id);
  await api.patchMe(ctx.from.id, { marketingOptOut: !state.user.marketingOptOut });
  await showNotifications(ctx, api);
}

function capture(match: string | RegExpMatchArray, index: number): string {
  return typeof match === 'string' ? match : (match[index] ?? '');
}

async function isAdmin(ctx: RrContext, api: ApiClient): Promise<boolean> {
  if (!ctx.from) return false;
  try {
    await api.getAdminRole(ctx.from.id);
    return true;
  } catch {
    return false;
  }
}

async function adminStats(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from || !(await isAdmin(ctx, api))) return;
  const stats = await api.adminStats(ctx.from.id);
  await ctx.reply(
    ctx.t('bot.admin.stats') + `\n${String(stats.users)} / ${String(stats.activeSubscriptions)}`,
  );
}

async function adminUser(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from || !(await isAdmin(ctx, api))) return;
  const query = ctx.message?.text?.split(/\s+/u)[1];
  if (!query) return;
  const user = await api.adminUser(ctx.from.id, query);
  await ctx.reply(ctx.t('bot.admin.user', { id: user.telegramId }));
}

async function adminExtend(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from || !(await isAdmin(ctx, api))) return;
  const [, target, rawDays] = ctx.message?.text?.split(/\s+/u) ?? [];
  const days = Number(rawDays);
  if (!target || !Number.isInteger(days)) return;
  const result = await api.adminExtend(ctx.from.id, target, days);
  await ctx.reply(ctx.t('bot.admin.extended', { days: result.days }));
}

async function adminBroadcastStatus(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from || !(await isAdmin(ctx, api))) return;
  const status = await api.adminBroadcastStatus(ctx.from.id);
  await ctx.reply(
    status
      ? `${status.status}: ${String(status.sent)}/${String(status.total)}`
      : ctx.t('bot.admin.broadcast'),
  );
}
