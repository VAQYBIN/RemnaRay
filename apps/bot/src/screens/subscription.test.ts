import { describe, expect, it } from 'vitest';

import { showClients, showSubscription } from './subscription.js';
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

  it('shows the details of an active subscription', async () => {
    const { ctx, api, texts } = screen('active');
    await showSubscription(ctx, api);
    expect(texts).toEqual(['bot.screen.sub.details']);
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
