import { describe, expect, it } from 'vitest';

import { showProfile } from './profile.js';
import type { RrContext } from '../types.js';

describe('bot profile screen (FR-122, owner decision F9)', () => {
  it('shows the account at a glance with the cabinet, language and receipt email', async () => {
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
      getMe: () => ({
        telegramId: 123,
        language: 'ru',
        email: 'me@example.test',
        balance: { amountMinor: 15000, currency: 'RUB' },
        balanceHeld: { amountMinor: 0, currency: 'RUB' },
        referralCode: 'AB12CD34',
      }),
      getSubscription: () => ({
        subscription: { status: 'active', expiresAt: '2026-10-01T00:00:00.000Z', daysLeft: 5 },
        panel: null,
        clients: [],
      }),
    } as never;

    await showProfile(ctx, api);

    expect(params).toContainEqual(
      expect.objectContaining({
        key: 'bot.screen.profile.details',
        telegramId: 123,
        language: 'Русский',
        referralCode: 'AB12CD34',
        email: 'me@example.test',
      }),
    );
    const details = params.find((item) => item.key === 'bot.screen.profile.details');
    expect(String(details?.['balance'])).toContain('150');
    expect(params).toContainEqual(
      expect.objectContaining({ key: 'bot.screen.profile.subscription', days: 5 }),
    );
    const data = (
      markups[0] as { inline_keyboard: Array<Array<{ callback_data?: string }>> }
    ).inline_keyboard
      .flat()
      .map((button) => button.callback_data);
    expect(data).toEqual(['account', 'lang', 'profile:email', 'home']);
  });
});
