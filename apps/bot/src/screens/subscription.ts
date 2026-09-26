import { InputFile, InlineKeyboard } from 'grammy';
import QRCode from 'qrcode';

import type { ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, formatDate, show } from './common.js';

const GIGABYTE = 1024 ** 3;

/** Section 12 `sub:guide:<platform>`: the platforms guides exist for. */
export const GUIDE_PLATFORMS = ['ios', 'android', 'windows', 'macos', 'linux'] as const;

function gigabytes(bytes: number): string {
  return `${(bytes / GIGABYTE).toFixed(bytes % GIGABYTE === 0 ? 0 : 1)} GB`;
}

/**
 * Section 12 `sub` (FR-041): plan, end date and days left, traffic used of
 * the limit, devices of the limit, the panel status and the link, with
 * `sub:qr`, `sub:clients`, `sub:devices`, `renew`, `plan:change`,
 * `sub:revoke` and back.
 */
export async function showSubscription(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const telegramId = ctx.from.id;
  const state = await api.getSubscription(telegramId);
  if (!state.subscription) {
    await show(ctx, ctx.t('bot.screen.sub.empty'), backButton(ctx));
    return;
  }
  // EX-01: the panel has not been reached yet; the link comes as a message.
  if (state.subscription.status === 'provisioning') {
    await show(ctx, ctx.t('bot.screen.sub.provisioning'), backButton(ctx));
    return;
  }
  const subscription = state.subscription;
  const panel = state.panel;
  // The device count comes from the panel; the screen still opens without it.
  let devices: number | null = null;
  if (panel)
    try {
      devices = (await api.getDevices(telegramId)).items.length;
    } catch {
      devices = null;
    }
  const limit = panel?.deviceLimit ?? subscription.plan?.deviceLimit ?? 0;
  const plan = subscription.plan
    ? (subscription.plan.name[ctx.locale] ?? subscription.plan.name['ru'] ?? subscription.plan.slug)
    : ctx.t('bot.screen.sub.trialPlan');
  const lines = [
    ctx.t('bot.screen.sub.info', {
      plan,
      until: formatDate(subscription.expiresAt, ctx.locale),
      days: subscription.daysLeft,
    }),
    panel
      ? panel.trafficLimitBytes > 0
        ? ctx.t('bot.screen.sub.traffic', {
            used: gigabytes(panel.usedTrafficBytes),
            limit: gigabytes(panel.trafficLimitBytes),
          })
        : ctx.t('bot.screen.sub.trafficUnlimited', { used: gigabytes(panel.usedTrafficBytes) })
      : '',
    ctx.t('bot.screen.sub.devices', {
      count: devices ?? '—',
      limit: limit > 0 ? limit : '∞',
    }),
    panel?.status
      ? ctx.t('bot.screen.sub.status', {
          status: ctx.t(`bot.screen.sub.panelStatus.${panel.status}`),
        })
      : '',
    panel ? ctx.t('bot.screen.sub.link', { link: panel.subscriptionUrl }) : '',
  ];
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.btn.clients'), 'sub:clients')
    .text(ctx.t('bot.btn.qr'), 'sub:qr')
    .row()
    .text(ctx.t('bot.btn.devices'), 'sub:devices')
    .row()
    .text(ctx.t('bot.btn.renew'), 'plans');
  if (subscription.canChangePlan) keyboard.text(ctx.t('bot.btn.planChange'), 'plan:change');
  keyboard.row();
  if (subscription.canRevoke) keyboard.text(ctx.t('bot.btn.revoke'), 'sub:revoke').row();
  keyboard.text(ctx.t('bot.btn.back'), 'home');
  await show(ctx, lines.filter(Boolean).join('\n'), keyboard);
}

/** Section 12 `sub:revoke:confirm`: the warning before the link is reset. */
export async function confirmRevoke(ctx: RrContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text(ctx.t('bot.btn.confirm'), 'sub:revoke:go')
    .row()
    .text(ctx.t('bot.btn.back'), 'sub');
  await show(ctx, ctx.t('bot.screen.sub.revokeWarn'), keyboard);
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
  // `sub:guide:<platform>` for the platforms the configured clients cover.
  const platforms = GUIDE_PLATFORMS.filter((platform) =>
    state.clients.some((client) => client.platforms.includes(platform)),
  );
  for (const platform of platforms)
    keyboard.text(ctx.t(`bot.btn.guide.${platform}`), `sub:guide:${platform}`);
  if (platforms.length > 0) keyboard.row();
  keyboard.text(ctx.t('bot.btn.back'), 'sub');
  await show(ctx, ctx.t('bot.screen.sub.link', { link }), keyboard);
}

/** Section 12 `sub:guide:<platform>`: the `bot.guide.<platform>` instructions. */
export async function showGuide(ctx: RrContext, platform: string): Promise<void> {
  await show(ctx, ctx.t(`bot.guide.${platform}`), backButton(ctx, 'sub:clients'));
}

/**
 * Section 12 `sub:devices` (FR-026): the HWID devices, with a remove button
 * each (`dev:rm:<hwid8>`) when `subscription.user_can_remove_devices` allows it.
 */
export async function showDevices(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const devices = await api.getDevices(ctx.from.id);
  const keyboard = new InlineKeyboard();
  const lines = devices.items.map((device) => {
    const name = [device.deviceModel, device.platform, device.osVersion]
      .filter(Boolean)
      .join(' · ');
    return `• ${name || device.hwid.slice(0, 8)}${device.createdAt ? ` — ${formatDate(device.createdAt, ctx.locale)}` : ''}`;
  });
  if (devices.canRemove)
    for (const device of devices.items)
      keyboard
        .text(
          ctx.t('bot.btn.deviceRemove', {
            name: device.deviceModel ?? device.platform ?? device.hwid.slice(0, 8),
          }),
          `dev:rm:${device.hwid.slice(0, 8)}`,
        )
        .row();
  keyboard.text(ctx.t('bot.btn.back'), 'sub');
  await show(
    ctx,
    lines.length > 0
      ? `${ctx.t('bot.screen.devices.title')}\n${lines.join('\n')}`
      : ctx.t('bot.screen.devices.empty'),
    keyboard,
  );
}

/** `dev:rm:<hwid8>`: the device whose HWID starts with the prefix. */
export async function removeDevice(ctx: RrContext, api: ApiClient, prefix: string): Promise<void> {
  if (!ctx.from) return;
  const devices = await api.getDevices(ctx.from.id);
  const device = devices.items.find((item) => item.hwid.startsWith(prefix));
  if (device && devices.canRemove) await api.removeDevice(ctx.from.id, device.hwid);
  await showDevices(ctx, api);
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
    caption: ctx.t('bot.screen.sub.link', { link }),
    parse_mode: 'HTML',
  });
}
