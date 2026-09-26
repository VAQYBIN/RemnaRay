import { describe, expect, it } from 'vitest';

import { removeDevice, showClients, showDevices, showSubscription } from './subscription.js';
import type { RrContext } from '../types.js';

function screen(status: string) {
  const texts: string[] = [];
  const ctx = {
    from: { id: 123 },
    session: {},
    t: (key: string) => key,
    reply: (text: string) => {
      texts.push(text);
      return { message_id: 1 };
    },
  } as unknown as RrContext;
  const api = {
    getSubscription: () => ({
      subscription: {
        status,
        expiresAt: '2026-10-01T00:00:00.000Z',
        daysLeft: 3,
        canChangePlan: false,
        canRevoke: false,
      },
      panel: null,
    }),
  } as never;
  return { ctx, api, texts };
}

describe('bot subscription screen', () => {
  it('says the subscription is being activated while the panel is not reached (EX-01)', async () => {
    const { ctx, api, texts } = screen('provisioning');
    await showSubscription(ctx, api);
    expect(texts).toEqual(['bot.screen.sub.provisioning']);
  });

  it('shows plan, term, traffic, devices and panel status with every section 12 button (FR-041)', async () => {
    const params: Record<string, unknown>[] = [];
    const markups: unknown[] = [];
    const ctx = {
      from: { id: 123 },
      locale: 'ru',
      session: {},
      t: (key: string, values: Record<string, unknown> = {}) => {
        params.push({ key, ...values });
        return key;
      },
      reply: (_text: string, options: { reply_markup?: unknown }) => {
        markups.push(options.reply_markup);
        return { message_id: 1 };
      },
    } as unknown as RrContext;
    const api = {
      getSubscription: () => ({
        subscription: {
          status: 'active',
          plan: { id: 'p', slug: 'month', name: { ru: 'Месяц' }, deviceLimit: 3 },
          expiresAt: '2026-10-01T00:00:00.000Z',
          daysLeft: 5,
          canChangePlan: true,
          canRevoke: true,
        },
        panel: {
          status: 'ACTIVE',
          subscriptionUrl: 'https://sub.example/x',
          usedTrafficBytes: 2 * 1024 ** 3,
          trafficLimitBytes: 10 * 1024 ** 3,
          deviceLimit: 3,
        },
        clients: [],
      }),
      getDevices: () => ({ items: [{ hwid: 'abcdef0123' }], canRemove: true }),
    } as never;

    await showSubscription(ctx, api);

    expect(params).toContainEqual(
      expect.objectContaining({ key: 'bot.screen.sub.info', plan: 'Месяц', days: 5 }),
    );
    expect(params).toContainEqual({ key: 'bot.screen.sub.traffic', used: '2 GB', limit: '10 GB' });
    expect(params).toContainEqual({ key: 'bot.screen.sub.devices', count: 1, limit: 3 });
    expect(params).toContainEqual({
      key: 'bot.screen.sub.status',
      status: 'bot.screen.sub.panelStatus.ACTIVE',
    });
    const data = (
      markups[0] as { inline_keyboard: Array<Array<{ callback_data?: string }>> }
    ).inline_keyboard
      .flat()
      .map((button) => button.callback_data);
    expect(data).toEqual([
      'sub:clients',
      'sub:qr',
      'sub:devices',
      'plans',
      'plan:change',
      'sub:revoke',
      'home',
    ]);
  });

  it('lists devices with a remove button each when removal is allowed (FR-026)', async () => {
    const markups: unknown[] = [];
    const removed: string[] = [];
    const ctx = {
      from: { id: 123 },
      locale: 'ru',
      session: {},
      t: (key: string) => key,
      reply: (_text: string, options: { reply_markup?: unknown }) => {
        markups.push(options.reply_markup);
        return { message_id: 1 };
      },
    } as unknown as RrContext;
    const api = {
      getDevices: () => ({
        items: [{ hwid: 'abcdef0123456', deviceModel: 'iPhone', platform: 'iOS' }],
        canRemove: true,
      }),
      removeDevice: (_telegramId: number, hwid: string) => {
        removed.push(hwid);
      },
    } as never;

    await showDevices(ctx, api);
    const data = (
      markups[0] as { inline_keyboard: Array<Array<{ callback_data?: string }>> }
    ).inline_keyboard
      .flat()
      .map((button) => button.callback_data);
    expect(data).toEqual(['dev:rm:abcdef01', 'sub']);

    await removeDevice(ctx, api, 'abcdef01');
    expect(removed).toEqual(['abcdef0123456']);
  });

  it('opens each client through an https page, since Telegram buttons take http(s) and tg:// only', async () => {
    const markups: unknown[] = [];
    const ctx = {
      from: { id: 123 },
      locale: 'en',
      session: {},
      t: (key: string) => key,
      reply: (_text: string, options: { reply_markup?: unknown }) => {
        markups.push(options.reply_markup);
        return { message_id: 1 };
      },
    } as unknown as RrContext;
    const link = 'https://sub.example/abc?x=1';
    const api = {
      getConfig: () => ({ webUrl: 'https://shop.example' }),
      getSubscription: () => ({
        subscription: null,
        panel: { subscriptionUrl: link, usedTrafficBytes: 0, trafficLimitBytes: 0 },
        clients: [
          {
            id: 'happ',
            name: 'Happ',
            platforms: ['ios'],
            deepLink: `happ://add/${encodeURIComponent(link)}`,
          },
          { id: 'none', name: 'No template', platforms: [], deepLink: null },
        ],
      }),
    } as never;

    await showClients(ctx, api);

    const rows = (markups[0] as { inline_keyboard: Array<Array<{ text: string; url?: string }>> })
      .inline_keyboard;
    const urls = rows.flat().flatMap((button) => (button.url ? [button.url] : []));
    expect(urls).toEqual([`https://shop.example/en/open/happ#${encodeURIComponent(link)}`]);
    expect(rows.flat().map((button) => button.text)).toContain('Happ');
  });
});
