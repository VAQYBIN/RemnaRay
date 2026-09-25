import { describe, expect, it } from 'vitest';

import { showSubscription } from './subscription.js';
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
});
