import { InputFile, InlineKeyboard } from 'grammy';
import QRCode from 'qrcode';

import type { ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, formatDate, show } from './common.js';

export async function showSubscription(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const state = await api.getSubscription(ctx.from.id);
  if (!state.subscription) {
    await show(ctx, ctx.t('bot.screen.sub.empty'), backButton(ctx));
    return;
  }
  // EX-01: the panel has not been reached yet; the link comes as a message.
  if (state.subscription.status === 'provisioning') {
    await show(ctx, ctx.t('bot.screen.sub.provisioning'), backButton(ctx));
    return;
  }
  const link = state.panel?.subscriptionUrl ?? '';
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.btn.clients'), 'sub:clients')
    .row()
    .text(ctx.t('bot.btn.qr'), 'sub:qr')
    .row()
    .text(ctx.t('bot.btn.revoke'), 'sub:revoke')
    .row()
    .text(ctx.t('bot.btn.renew'), 'plans')
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  await show(
    ctx,
    ctx.t('bot.screen.sub.details', {
      until: formatDate(state.subscription.expiresAt, ctx.locale),
      link,
    }),
    keyboard,
  );
}

export async function confirmRevoke(ctx: RrContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.btn.confirm'), 'sub:revoke:go')
    .row()
    .text(ctx.t('bot.btn.back'), 'sub');
  await show(ctx, ctx.t('bot.screen.sub.details', { until: '', link: '' }), keyboard);
}

export async function showClients(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const state = await api.getSubscription(ctx.from.id);
  const link = state.panel?.subscriptionUrl;
  if (!link) {
    await show(ctx, ctx.t('bot.screen.sub.empty'), backButton(ctx, 'sub'));
    return;
  }
  // Telegram URL buttons take only http(s) and tg:// links (Bot API
  // InlineKeyboardButton.url), and a client's deep link is its own scheme, so
  // each button opens the site's page for that client, which hands the link
  // to the app. The subscription link travels in the fragment, which the
  // browser never sends to the server.
  const { webUrl } = await api.getConfig();
  const keyboard = new InlineKeyboard();
  for (const client of state.clients.filter((item) => item.deepLink)) {
    const page = new URL(`/${ctx.locale}/open/${encodeURIComponent(client.id)}`, webUrl);
    keyboard.url(client.name, `${page.href}#${encodeURIComponent(link)}`).row();
  }
  keyboard.text(ctx.t('bot.btn.back'), 'sub');
  await show(ctx, `<code>${link}</code>`, keyboard);
}

export async function showQr(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const state = await api.getSubscription(ctx.from.id);
  const link = state.panel?.subscriptionUrl;
  if (!link) {
    await show(ctx, ctx.t('bot.screen.sub.empty'), backButton(ctx, 'sub'));
    return;
  }
  const image = await QRCode.toBuffer(link, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
  await ctx.replyWithPhoto(new InputFile(image, 'subscription-qr.png'), {
    caption: ctx.t('bot.screen.sub.details', { until: '', link }),
    parse_mode: 'HTML',
  });
}
