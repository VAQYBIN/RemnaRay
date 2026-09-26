import { describe, expect, it } from 'vitest';

import { showReferralList, showReferrals } from './referrals.js';
import type { RrContext } from '../types.js';

function screen() {
  const texts: string[] = [];
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
    reply: (text: string, options: { reply_markup?: unknown } = {}) => {
      texts.push(text);
      markups.push(options.reply_markup);
      return { message_id: 1 };
    },
  } as unknown as RrContext;
  const api = {
    getConfig: () => ({ brandName: 'Manta VPN' }),
    getReferrals: () => ({
      code: 'AB12CD34',
      link: 'https://shop.test/r/AB12CD34',
      botLink: 'https://t.me/manta_bot?start=ref_AB12CD34',
      invited: 3,
      converted: 1,
      earned: { amountMinor: 5980, currency: 'RUB' },
      program: {
        mode: 'percent_first',
        percent: 20,
        fixedMinor: 0,
        inviteeBonus: { type: 'days', value: 3 },
      },
    }),
    getReferralList: () => ({
      items: [
        {
          maskedName: 'A••••',
          joinedAt: '2026-09-20T10:00:00.000Z',
          status: 'converted',
          rewardMinor: 5980,
        },
      ],
      nextCursor: null,
    }),
  } as never;
  return { ctx, api, texts, params, markups };
}

describe('bot referral screen (FR-151, section 12 `ref`)', () => {
  it('shows the bot link, the statistics with the earned sum and the terms', async () => {
    const { ctx, api, params, markups } = screen();

    await showReferrals(ctx, api);

    expect(params).toContainEqual(
      expect.objectContaining({
        key: 'bot.screen.ref.details',
        link: 'https://t.me/manta_bot?start=ref_AB12CD34',
        invited: 3,
        converted: 1,
      }),
    );
    const details = params.find((item) => item.key === 'bot.screen.ref.details');
    expect(String(details?.['earned'])).toContain('59,80');
    expect(params).toContainEqual({ key: 'bot.screen.ref.termsPercent', percent: 20 });
    expect(params).toContainEqual({ key: 'bot.screen.ref.bonusDays', days: 3 });
    const buttons = (
      markups[0] as { inline_keyboard: Array<Array<Record<string, unknown>>> }
    ).inline_keyboard.flat();
    // `ref:share` is switch_inline_query with the invitation text.
    expect(buttons[0]).toMatchObject({ switch_inline_query: 'bot.screen.ref.invite' });
    expect(params).toContainEqual({
      key: 'bot.screen.ref.invite',
      brand: 'Manta VPN',
      link: 'https://t.me/manta_bot?start=ref_AB12CD34',
    });
    expect(buttons.map((button) => button['callback_data'])).toContain('ref:list');
  });

  it('lists the invited customers with their status and reward', async () => {
    const { ctx, api, texts, params } = screen();

    await showReferralList(ctx, api);

    expect(params).toContainEqual(
      expect.objectContaining({
        key: 'bot.screen.ref.item',
        name: 'A••••',
        status: 'bot.screen.ref.status.converted',
      }),
    );
    expect(texts[0]).toContain('bot.screen.ref.listTitle');
  });
});
