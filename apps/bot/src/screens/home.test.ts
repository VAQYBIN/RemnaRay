import { describe, expect, it } from 'vitest';

import { homeKeyboard, showAccount, showHome, showTrialConfirm } from './home.js';
import { formatMinor } from './common.js';
import type { RrContext } from '../types.js';

function context() {
  return { t: (key: string) => key } as unknown as RrContext;
}

describe('bot home screen', () => {
  it('shows trial and buy for a user without a subscription', () => {
    const keyboard = homeKeyboard(context(), { trialAvailable: true }, null);
    const callbacks = keyboard.inline_keyboard.flatMap((row) =>
      row.flatMap((item) => ('callback_data' in item ? [item.callback_data] : [])),
    );
    expect(callbacks).toContain('trial:confirm');
    expect(callbacks).toContain('plans');
    expect(callbacks).toContain('account');
  });

  it('issues a web token and sends the localized account URL button', async () => {
    const calls: string[] = [];
    let keyboard: { inline_keyboard: Array<Array<Record<string, string>>> } | undefined;
    const ctx = {
      from: { id: 123 },
      session: {},
      t: (key: string) => key,
      reply: (_text: string, options: { reply_markup: typeof keyboard }) => {
        keyboard = options.reply_markup;
        return { message_id: 1 };
      },
    } as unknown as RrContext;
    const api = {
      getConfig: () => ({ webUrl: 'https://shop.example.test' }),
      issueToken: (telegramId: number) => {
        calls.push(String(telegramId));
        return { token: 'short-lived-jwt', user: {} };
      },
    } as never;

    await showAccount(ctx, api);

    expect(calls).toEqual(['123']);
    const url = keyboard?.inline_keyboard.flat().find((item) => typeof item.url === 'string')?.url;
    expect(url).toBe('https://shop.example.test/auth/tg?token=short-lived-jwt');
  });

  it("greets with the shop's brand and states the configured trial (FR-122)", async () => {
    const params: Record<string, unknown>[] = [];
    const ctx = {
      from: { id: 123 },
      session: {},
      t: (key: string, values: Record<string, unknown> = {}) => {
        params.push({ key, ...values });
        return key;
      },
      reply: () => ({ message_id: 1 }),
    } as unknown as RrContext;
    const api = {
      getConfig: () => ({ brandName: 'Manta VPN', trial: { days: 7, trafficGb: 25 } }),
      getMe: () => ({ trialAvailable: true }),
      getSubscription: () => ({ subscription: null, panel: null, clients: [] }),
    } as never;

    await showHome(ctx, api);
    await showTrialConfirm(ctx, api);

    expect(params).toContainEqual({ key: 'bot.screen.home.welcome', brand: 'Manta VPN' });
    expect(params).toContainEqual({ key: 'bot.screen.trial.confirm', days: 7, traffic: '25 GB' });
  });

  it('formats minor-unit prices without floating-point business arithmetic', () => {
    expect(formatMinor('29900')).toContain('299');
  });
});
