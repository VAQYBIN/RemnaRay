import { describe, expect, it } from 'vitest';

import { homeKeyboard } from './home.js';
import { formatMinor } from './common.js';
import type { RrContext } from '../types.js';

function context() {
  return { t: (key: string) => key } as unknown as RrContext;
}

describe('bot home screen', () => {
  it('shows trial and buy for a user without a subscription', () => {
    const keyboard = homeKeyboard(context(), {
      user: {} as never,
      balance: { amountMinor: '0', currency: 'RUB' },
      subscription: null,
      trialAvailable: true,
    });
    const callbacks = keyboard.inline_keyboard.flatMap((row) =>
      row.flatMap((item) => ('callback_data' in item ? [item.callback_data] : [])),
    );
    expect(callbacks).toContain('trial:confirm');
    expect(callbacks).toContain('plans');
  });

  it('formats minor-unit prices without floating-point business arithmetic', () => {
    expect(formatMinor('29900')).toContain('299');
  });
});
