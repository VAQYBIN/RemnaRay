import { describe, expect, it } from 'vitest';
import { Bot } from 'grammy';

import { TelegramMock } from './index.js';

describe('Telegram mock Bot API', () => {
  it('supports grammY getMe, setWebhook, updates and sendMessage', async () => {
    const mock = new TelegramMock();
    await mock.start();
    try {
      const bot = new Bot(mock.token, { client: { apiRoot: mock.apiRoot } });
      await expect(bot.api.getMe()).resolves.toMatchObject({ username: 'remnaray_mock_bot' });
      await bot.api.setWebhook('http://127.0.0.1/webhook', { secret_token: 'secret' });
      mock.push({ message: { chat: { id: 42 }, text: '/start' } });
      await expect(bot.api.getUpdates({ offset: 0, timeout: 0 })).resolves.toHaveLength(1);
      await bot.api.sendMessage(42, 'hello');
      expect(mock.sentMessages).toEqual([{ chatId: 42, text: 'hello' }]);
    } finally {
      await mock.stop();
    }
  });

  it('emulates a retryable Telegram 429 response', async () => {
    const mock = new TelegramMock();
    await mock.start();
    try {
      mock.failNext(429, 1);
      const bot = new Bot(mock.token, { client: { apiRoot: mock.apiRoot } });
      await expect(bot.api.sendMessage(42, 'hello')).rejects.toMatchObject({ error_code: 429 });
    } finally {
      await mock.stop();
    }
  });

  it('answers the Telegram Stars payment methods (Bot API 10.3)', async () => {
    const mock = new TelegramMock();
    await mock.start();
    try {
      const bot = new Bot(mock.token, { client: { apiRoot: mock.apiRoot } });
      const link = await bot.api.createInvoiceLink('Plan', 'Plan', 'inv_1', '', 'XTR', [
        { label: 'Plan', amount: 225 },
      ]);
      expect(link).toMatch(/^https:\/\/t\.me\/\$/u);
      await expect(
        bot.api.sendInvoice(42, 'Plan', 'Plan', 'inv_1', 'XTR', [{ label: 'Plan', amount: 225 }]),
      ).resolves.toMatchObject({ chat: { id: 42 }, invoice: { currency: 'XTR' } });
      await expect(bot.api.answerPreCheckoutQuery('query-1', true)).resolves.toBe(true);
      expect(mock.calls.map((call) => call.method)).toEqual([
        'createInvoiceLink',
        'sendInvoice',
        'answerPreCheckoutQuery',
      ]);
      expect(mock.calls[1]?.payload).toMatchObject({ payload: 'inv_1', currency: 'XTR' });
    } finally {
      await mock.stop();
    }
  });

  it('answers every other method instead of leaving the request open', async () => {
    const mock = new TelegramMock();
    await mock.start();
    try {
      const bot = new Bot(mock.token, { client: { apiRoot: mock.apiRoot } });
      await expect(bot.api.editMessageText(42, 1, 'edited')).resolves.toBeTruthy();
    } finally {
      await mock.stop();
    }
  });

  it('runs the first E2E-01 bot interaction through a real grammY handler', async () => {
    const mock = new TelegramMock();
    await mock.start();
    try {
      const bot = new Bot(mock.token, { client: { apiRoot: mock.apiRoot } });
      bot.command('start', (ctx) => ctx.reply('welcome'));
      await bot.init();
      mock.push({
        message: {
          message_id: 1,
          date: 1_758_000_000,
          chat: { id: 42, type: 'private' },
          from: { id: 42, is_bot: false, first_name: 'User' },
          text: '/start ref_ABCD2345',
          entities: [{ type: 'bot_command', offset: 0, length: 6 }],
        },
      });
      const updates = await bot.api.getUpdates({ offset: 0, timeout: 0 });
      for (const update of updates) await bot.handleUpdate(update);
      expect(mock.sentMessages).toContainEqual({ chatId: 42, text: 'welcome' });
    } finally {
      await mock.stop();
    }
  });
});
