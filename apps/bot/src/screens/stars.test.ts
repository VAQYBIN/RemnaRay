import { Bot } from 'grammy';
import type { Update } from 'grammy/types';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError, type ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { isPaymentUpdate, registerStars, sendStarsInvoice } from './stars.js';

const INVOICE_ID = '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee';
const user = { id: 42, is_bot: false, first_name: 'Payer' };

type Call = { method: string; payload: Record<string, unknown> };

function harness(api: Partial<Record<keyof ApiClient, unknown>>) {
  const bot = new Bot<RrContext>('123:test', {
    botInfo: {
      id: 1,
      is_bot: true,
      first_name: 'Shop',
      username: 'shop_bot',
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
    } as never,
  });
  const calls: Call[] = [];
  bot.api.config.use((_prev, method, payload) => {
    calls.push({ method, payload });
    return Promise.resolve({ ok: true, result: true } as never);
  });
  bot.use((ctx, next) => {
    ctx.t = (key: string) => `t:${key}`;
    Object.assign(ctx, { session: {} });
    return next();
  });
  registerStars(bot, api as unknown as ApiClient);
  bot.command('start', async (ctx) => {
    await sendStarsInvoice(ctx, api as unknown as ApiClient, ctx.match.slice(4));
  });
  return { bot, calls };
}

const precheckoutUpdate: Update = {
  update_id: 1,
  pre_checkout_query: {
    id: 'query-1',
    from: user,
    currency: 'XTR',
    total_amount: 225,
    invoice_payload: `inv_${INVOICE_ID}`,
  },
};

const successfulPaymentUpdate: Update = {
  update_id: 2,
  message: {
    message_id: 5,
    date: 1_758_000_000,
    chat: { id: 42, type: 'private', first_name: 'Payer' },
    from: user,
    successful_payment: {
      currency: 'XTR',
      total_amount: 225,
      invoice_payload: `inv_${INVOICE_ID}`,
      telegram_payment_charge_id: 'charge-1',
      provider_payment_charge_id: 'provider-1',
    },
  },
};

describe('Telegram Stars in the bot (section 11.3.6)', () => {
  it('approves a pre-checkout query the shop accepts', async () => {
    const starsPrecheckout = vi.fn().mockResolvedValue({ ok: true });
    const { bot, calls } = harness({ starsPrecheckout });

    await bot.handleUpdate(precheckoutUpdate);

    expect(starsPrecheckout).toHaveBeenCalledWith({
      telegramId: 42,
      invoicePayload: `inv_${INVOICE_ID}`,
      totalAmount: 225,
      currency: 'XTR',
    });
    expect(calls).toEqual([
      { method: 'answerPreCheckoutQuery', payload: { pre_checkout_query_id: 'query-1', ok: true } },
    ]);
  });

  it.each([
    ['INVOICE_EXPIRED', new ApiClientError(409, 'INVOICE_EXPIRED'), 't:bot.error.invoice_expired'],
    [
      'AMOUNT_MISMATCH',
      new ApiClientError(409, 'AMOUNT_MISMATCH'),
      't:bot.error.invoice_unavailable',
    ],
    ['an unavailable API', new Error('timeout'), 't:bot.error.payment_unavailable'],
  ])('declines the query on %s with a localized reason', async (_name, error, message) => {
    const { bot, calls } = harness({ starsPrecheckout: vi.fn().mockRejectedValue(error) });

    await bot.handleUpdate(precheckoutUpdate);

    expect(calls).toEqual([
      {
        method: 'answerPreCheckoutQuery',
        payload: { pre_checkout_query_id: 'query-1', ok: false, error_message: message },
      },
    ]);
  });

  it('records successful_payment through the internal boundary', async () => {
    const starsSuccessfulPayment = vi.fn().mockResolvedValue({ ok: true, status: 'paid' });
    const { bot } = harness({ starsSuccessfulPayment });

    await bot.handleUpdate(successfulPaymentUpdate);

    expect(starsSuccessfulPayment).toHaveBeenCalledWith({
      telegramId: 42,
      telegramPaymentChargeId: 'charge-1',
      providerPaymentChargeId: 'provider-1',
      invoicePayload: `inv_${INVOICE_ID}`,
      totalAmount: 225,
      currency: 'XTR',
    });
  });

  it('fails the update when the payment could not be recorded, so it is redelivered', async () => {
    const { bot } = harness({
      starsSuccessfulPayment: vi.fn().mockRejectedValue(new Error('api down')),
    });

    await expect(bot.handleUpdate(successfulPaymentUpdate)).rejects.toThrow('api down');
  });

  it('sends the Stars invoice for /start inv_<id>', async () => {
    const starsCreateLink = vi.fn().mockResolvedValue({
      invoiceId: INVOICE_ID,
      link: 'https://t.me/$abc',
      title: 'Premium',
      description: 'Premium 30 days',
      payload: `inv_${INVOICE_ID}`,
      currency: 'XTR',
      amount: 225,
    });
    const { bot, calls } = harness({ starsCreateLink });

    await bot.handleUpdate({
      update_id: 3,
      message: {
        message_id: 6,
        date: 1_758_000_000,
        chat: { id: 42, type: 'private', first_name: 'Payer' },
        from: user,
        text: `/start inv_${INVOICE_ID}`,
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });

    expect(starsCreateLink).toHaveBeenCalledWith(42, INVOICE_ID);
    expect(calls).toEqual([
      {
        method: 'sendInvoice',
        payload: {
          chat_id: 42,
          title: 'Premium',
          description: 'Premium 30 days',
          payload: `inv_${INVOICE_ID}`,
          currency: 'XTR',
          prices: [{ label: 'Premium', amount: 225 }],
          provider_token: '',
          start_parameter: `inv_${INVOICE_ID}`,
        },
      },
    ]);
  });

  it('explains an invoice that can no longer be paid instead of sending it', async () => {
    const { bot, calls } = harness({
      starsCreateLink: vi.fn().mockRejectedValue(new ApiClientError(409, 'INVOICE_EXPIRED')),
    });

    await bot.handleUpdate({
      update_id: 4,
      message: {
        message_id: 7,
        date: 1_758_000_000,
        chat: { id: 42, type: 'private', first_name: 'Payer' },
        from: user,
        text: `/start inv_${INVOICE_ID}`,
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });

    expect(calls[0]?.method).toBe('sendMessage');
    expect(calls[0]?.payload.text).toBe('t:bot.error.invoice_expired');
  });

  it('exempts payment updates from the per-user rate limit', () => {
    const context = (update: Update) => ({ update }) as unknown as RrContext;
    expect(isPaymentUpdate(context(precheckoutUpdate))).toBe(true);
    expect(isPaymentUpdate(context(successfulPaymentUpdate))).toBe(true);
    expect(
      isPaymentUpdate(
        context({
          update_id: 5,
          message: {
            message_id: 8,
            date: 1,
            chat: { id: 42, type: 'private', first_name: 'Payer' },
            from: user,
            text: 'hi',
          },
        }),
      ),
    ).toBe(false);
  });
});
