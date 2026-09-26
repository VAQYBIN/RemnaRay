import { InlineKeyboard } from 'grammy';

import type { ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { formatDate, formatMinor, show } from './common.js';

const LANGUAGES: Record<string, string> = { ru: 'Русский', en: 'English' };

/**
 * «Профиль» (FR-122 names the button; its contents are the owner's decision
 * of 2026-09-26): Telegram id, language, balance, subscription status and
 * term, referral code and receipt email, with «Открыть кабинет», «Язык» and
 * «Email для чеков».
 */
export async function showProfile(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const [me, state] = await Promise.all([api.getMe(ctx.from.id), api.getSubscription(ctx.from.id)]);
  const subscription = state.subscription;
  const lines = [
    ctx.t('bot.screen.profile.details', {
      telegramId: me.telegramId,
      language: LANGUAGES[me.language] ?? me.language,
      balance: formatMinor(me.balance.amountMinor, me.balance.currency),
      referralCode: me.referralCode,
      email: me.email ?? ctx.t('bot.screen.profile.noEmail'),
    }),
    subscription
      ? ctx.t('bot.screen.profile.subscription', {
          status: ctx.t(`bot.screen.profile.status.${subscription.status}`),
          until: formatDate(subscription.expiresAt, ctx.locale),
          days: subscription.daysLeft,
        })
      : ctx.t('bot.screen.profile.noSubscription'),
  ];
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.btn.account'), 'account')
    .row()
    .text(ctx.t('bot.btn.lang'), 'lang')
    .text(ctx.t('bot.btn.email'), 'profile:email')
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  await show(ctx, lines.join('\n'), keyboard);
}
