import { describe, expect, it } from 'vitest';

import { showBalance, showTopupProviders } from './index.js';
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

describe('bot top-up provider choice (FR-071)', () => {
  function topup(items: { code: string; kind: string; available: boolean }[]) {
    const markups: unknown[] = [];
    const created: unknown[] = [];
    const ctx = {
      from: { id: 123 },
      locale: 'ru',
      session: {},
      t: (key: string) => key,
      reply: (_text: string, options: { reply_markup?: unknown } = {}) => {
        markups.push(options.reply_markup);
        return { message_id: 1 };
      },
    } as unknown as RrContext;
    const api = {
      getPaymentMethods: () => ({
        items: items.map((item) => ({ ...item, displayName: { ru: item.code, en: item.code } })),
      }),
      createInvoice: (_telegramId: number, body: unknown) => {
        created.push(body);
        return {
          id: 'inv-1',
          status: 'pending',
          provider: 'yookassa',
          amount: { amountMinor: 10000, currency: 'RUB' },
          paymentUrl: 'https://pay.example/1',
          expiresAt: '2026-10-01T00:00:00.000Z',
          createdAt: '2026-09-26T00:00:00.000Z',
        };
      },
    } as never;
    return { ctx, api, markups, created };
  }

  it('asks which provider pays when there are several, never offering the balance', async () => {
    const { ctx, api, markups, created } = topup([
      { code: 'balance', kind: 'balance', available: true },
      { code: 'yookassa', kind: 'redirect', available: true },
      { code: 'stars', kind: 'stars', available: true },
      { code: 'lava', kind: 'redirect', available: false },
    ]);

    await showTopupProviders(ctx, api, 10000);

    const data = (
      markups[0] as { inline_keyboard: Array<Array<{ callback_data?: string }>> }
    ).inline_keyboard
      .flat()
      .map((button) => button.callback_data);
    expect(data).toEqual(['topup:10000:yookassa', 'topup:10000:stars', 'topup:open']);
    expect(created).toEqual([]);
  });

  it('creates the invoice at once when one provider is left', async () => {
    const { ctx, api, created } = topup([
      { code: 'balance', kind: 'balance', available: true },
      { code: 'yookassa', kind: 'redirect', available: true },
    ]);

    await showTopupProviders(ctx, api, 10000);

    expect(created).toEqual([{ kind: 'topup', provider: 'yookassa', amountMinor: 10000 }]);
  });
});
