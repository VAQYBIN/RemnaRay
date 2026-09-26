import { describe, expect, it } from 'vitest';

import { paymentKeyboard } from './common.js';
import { confirmPlanChange, showPlanChange } from './plan-change.js';
import type { RrContext } from '../types.js';

function context() {
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
  const data = () =>
    (
      markups.at(-1) as { inline_keyboard: Array<Array<{ callback_data?: string }>> }
    ).inline_keyboard
      .flat()
      .map((button) => button.callback_data);
  return { ctx, params, data };
}

const plans = {
  items: [
    {
      id: 'p1',
      slug: 'month',
      name: { ru: 'Месяц' },
      price: { amountMinor: 29900, currency: 'RUB' },
    },
    {
      id: 'p2',
      slug: 'year',
      name: { ru: 'Год' },
      price: { amountMinor: 299000, currency: 'RUB' },
    },
  ],
};
const methods = (balance: number) => ({
  items: [
    {
      code: 'balance',
      kind: 'balance',
      available: true,
      displayName: { ru: 'Баланс' },
      balance: { amountMinor: balance, currency: 'RUB' },
    },
    { code: 'yookassa', kind: 'redirect', available: true, displayName: { ru: 'ЮKassa' } },
  ],
});

describe('bot plan change (section 12 `plan:change`, FR-023)', () => {
  it('lists the other plans with what is left to pay', async () => {
    const { ctx, params, data } = context();
    const api = {
      getSubscription: () => ({ subscription: { canChangePlan: true, plan: { id: 'p1' } } }),
      getPlans: () => plans,
      getPlanChangeQuote: () => ({
        creditMinor: 10000,
        newPriceMinor: 299000,
        toPayMinor: 289000,
        canPayFromBalance: false,
      }),
    } as never;

    await showPlanChange(ctx, api);

    expect(data()).toEqual(['plan:change:year', 'sub']);
    expect(params).toContainEqual(
      expect.objectContaining({ key: 'bot.btn.planChangeTo', plan: 'Год' }),
    );
  });

  it('confirms the calculation and pays from the balance first when it is enough', async () => {
    const { ctx, params, data } = context();
    const api = {
      getPlans: () => plans,
      getPlanChangeQuote: () => ({
        creditMinor: 10000,
        newPriceMinor: 299000,
        toPayMinor: 289000,
        canPayFromBalance: true,
      }),
      getPaymentMethods: () => methods(300000),
    } as never;

    await confirmPlanChange(ctx, api, 'year');

    expect(params).toContainEqual(
      expect.objectContaining({ key: 'bot.screen.planChange.confirm', plan: 'Год' }),
    );
    expect(data()).toEqual([
      'plan:change:go:year:balance',
      'plan:change:go:year:yookassa',
      'plan:change',
    ]);
  });

  it('leaves the balance out when it does not cover the price', () => {
    const { ctx } = context();
    const keyboard = paymentKeyboard(ctx, methods(100).items, 29900, (code) => `pay:month:${code}`);
    expect(
      keyboard.inline_keyboard
        .flat()
        .map((button) => ('callback_data' in button ? button.callback_data : '')),
    ).toEqual(['pay:month:yookassa']);
  });
});
