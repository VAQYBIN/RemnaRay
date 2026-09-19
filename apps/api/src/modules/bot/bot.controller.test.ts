import { describe, expect, it } from 'vitest';

import {
  BotInternalController,
  BotUserController,
  TelegramWebhookController,
} from './bot.controller';

describe('bot ingress boundary', () => {
  it('writes a valid Telegram update to the Valkey stream', async () => {
    const calls: unknown[][] = [];
    const controller = new TelegramWebhookController(
      {
        redis: {
          eval: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve('1-0');
          },
        },
      } as never,
      {
        get: (key: string) =>
          Promise.resolve(key === 'bot.webhook_secret_path' ? 'path-secret' : 'header-secret'),
      } as never,
    );
    await controller.receive(
      'path-secret',
      { 'x-telegram-bot-api-secret-token': 'header-secret' },
      { update_id: 7, message: { text: '/start' } },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('tg:updates');
    expect(calls[0]).toContain(JSON.stringify({ update_id: 7, message: { text: '/start' } }));
  });

  it('serves locale messages and a mode-aware bot configuration', async () => {
    const settings: Record<string, unknown> = {
      'bot.mode': 'webhook',
      'domain.main': 'shop.example.test',
      'bot.webhook_secret_path': 'path-secret',
      'bot.webhook_secret_token': 'header-secret',
      'brand.support_forward_chat_id': null,
    };
    const controller = new BotInternalController(
      { db: { admin: { findMany: () => Promise.resolve([{ telegramId: 123n }]) } } } as never,
      { get: (key: string) => Promise.resolve(settings[key]) } as never,
    );
    expect(
      (controller.messages('en') as { messages: Record<string, string> }).messages['bot.btn.buy'],
    ).toBe('🛒 Buy');
    await expect(controller.config()).resolves.toMatchObject({
      mode: 'webhook',
      webhookUrl: 'https://shop.example.test/tg/webhook/path-secret',
      admins: ['123'],
    });
  });

  it('returns state used to choose the home menu', async () => {
    const controller = new BotUserController(
      {
        db: {
          user: {
            findUniqueOrThrow: () =>
              Promise.resolve({
                id: 'user-1',
                telegramId: 123n,
                username: null,
                firstName: 'User',
                language: 'ru',
                referralCode: 'ABCD2345',
                email: null,
                marketingOptOut: false,
                trialUsedAt: null,
              }),
          },
          account: { findFirst: () => Promise.resolve({ balanceMinor: 29900n }) },
          subscription: { findFirst: () => Promise.resolve(null) },
          transaction: { count: () => Promise.resolve(0) },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(controller.me('123')).resolves.toMatchObject({
      balance: { amountMinor: '29900' },
      trialAvailable: true,
      subscription: null,
    });
  });
});
