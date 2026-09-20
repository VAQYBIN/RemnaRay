import { InlineKeyboard } from 'grammy';

import type { ApiClient, HomeState, SubscriptionState } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, button, formatDate, show } from './common.js';

export function homeKeyboard(
  ctx: RrContext,
  state: Pick<HomeState, 'trialAvailable'>,
  subscription: SubscriptionState['subscription'],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (!subscription) {
    if (state.trialAvailable) keyboard.text(ctx.t('bot.btn.trial'), 'trial:confirm').row();
    keyboard.text(ctx.t('bot.btn.buy'), 'plans').row();
  } else {
    keyboard.text(ctx.t('bot.btn.sub'), 'sub').row();
    keyboard.text(ctx.t('bot.btn.renew'), 'plans').row();
  }
  keyboard.text(ctx.t('bot.btn.profile'), 'profile').row();
  keyboard
    .text(ctx.t('bot.btn.balance'), 'balance')
    .text(ctx.t('bot.btn.ref'), 'ref')
    .row()
    .text(ctx.t('bot.btn.support'), 'support')
    .text(ctx.t('bot.btn.lang'), 'lang');
  return keyboard;
}

export async function showHome(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const [state, subscriptionState] = await Promise.all([
    api.getMe(ctx.from.id),
    api.getSubscription(ctx.from.id),
  ]);
  const subscription = subscriptionState.subscription;
  const status = subscription
    ? ctx.t('bot.screen.home.subscription', { until: formatDate(subscription.expiresAt) })
    : ctx.t('bot.screen.home.noSubscription');
  await show(
    ctx,
    `${ctx.t('bot.screen.home.welcome', { brand: 'RemnaRay' })}\n\n${status}`,
    homeKeyboard(ctx, state, subscription),
  );
}

export async function showTrialConfirm(ctx: RrContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.btn.trial'), 'trial:go')
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  await show(ctx, ctx.t('bot.screen.trial.confirm', { days: 3, traffic: '10 GB' }), keyboard);
}

export function profileKeyboard(ctx: RrContext): InlineKeyboard {
  return backButton(ctx);
}

export function homeButton(ctx: RrContext): InlineKeyboard {
  return button(ctx, 'bot.btn.menu', 'home');
}
