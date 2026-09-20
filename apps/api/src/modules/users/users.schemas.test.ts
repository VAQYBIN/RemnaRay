import { describe, expect, it } from 'vitest';

import { isReferralCode, parseStartPayload, userUpsertSchema } from './users.schemas';

describe('users schemas', () => {
  it('parses Telegram deep-link payloads and ignores unknown values', () => {
    expect(parseStartPayload('/start ref_abcd2345')).toEqual({ referralCode: 'ABCD2345' });
    expect(parseStartPayload('promo_spring-2026')).toEqual({ promoCode: 'SPRING-2026' });
    expect(parseStartPayload('plan_pro-30')).toEqual({ planSlug: 'pro-30' });
    expect(parseStartPayload('inv_123')).toEqual({});
  });

  it('normalizes Telegram IDs to bigint and rejects malformed input', () => {
    expect(userUpsertSchema.parse({ telegramId: '123456789', languageCode: 'EN' }).telegramId).toBe(
      123456789n,
    );
    expect(() => userUpsertSchema.parse({ telegramId: 'not-an-id' })).toThrow();
    expect(isReferralCode('ABCD2345')).toBe(true);
    expect(isReferralCode('ABCIOO45')).toBe(false);
  });
});
