import { describe, expect, it } from 'vitest';

import { showBalance } from './index.js';
import type { RrContext } from '../types.js';

function screen(heldMinor: number) {
  const texts: string[] = [];
  const params: Record<string, unknown>[] = [];
  const ctx = {
    from: { id: 123 },
    session: {},
    t: (key: string, values: Record<string, unknown> = {}) => {
      params.push({ key, ...values });
      return key;
    },
    reply: (text: string) => {
      texts.push(text);
      return { message_id: 1 };
    },
  } as unknown as RrContext;
  const api = {
    getMe: () => ({
      balance: { amountMinor: 20000, currency: 'RUB' },
      balanceHeld: { amountMinor: heldMinor, currency: 'RUB' },
    }),
    getTransactions: () => ({ items: [] }),
  } as never;
  return { ctx, api, texts, params };
}

describe('bot balance screen (section 15.2)', () => {
  it('shows held referral rewards as pending under the available balance', async () => {
    const { ctx, api, texts, params } = screen(9900);
    await showBalance(ctx, api);
    expect(texts[0]).toContain('bot.screen.balance.details\nbot.screen.balance.held');
    expect(params.find((item) => item.key === 'bot.screen.balance.held')?.held).toContain('99');
  });

  it('adds no pending line when nothing is held', async () => {
    const { ctx, api, texts } = screen(0);
    await showBalance(ctx, api);
    expect(texts[0]).not.toContain('bot.screen.balance.held');
  });
});
