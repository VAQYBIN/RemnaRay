import { z } from 'zod';

const telegramIdSchema = z
  .union([
    z.string().regex(/^-?\d+$/, 'telegramId must be an integer'),
    z.number().int().refine(Number.isSafeInteger, 'telegramId must be a safe integer'),
  ])
  .transform((value) => BigInt(value));

export const userUpsertSchema = z.object({
  telegramId: telegramIdSchema,
  username: z.string().trim().min(1).max(255).optional(),
  firstName: z.string().trim().min(1).max(255).optional(),
  languageCode: z.string().trim().toLowerCase().max(16).optional(),
  startPayload: z.string().trim().max(128).optional(),
});

export type UserUpsertInput = z.infer<typeof userUpsertSchema>;

export type ParsedStartPayload = {
  referralCode?: string;
  promoCode?: string;
  planSlug?: string;
};

const referralCodePattern = /^[A-HJ-NP-Z2-9]+$/;

export function parseStartPayload(payload: string | undefined): ParsedStartPayload {
  if (!payload) return {};
  const token =
    payload
      .replace(/^\/start\s+/i, '')
      .split(/\s+/u)[0]
      ?.trim() ?? '';
  if (!token) return {};

  if (token.startsWith('ref_')) {
    const code = token.slice(4).toUpperCase();
    return referralCodePattern.test(code) ? { referralCode: code } : {};
  }
  if (token.startsWith('promo_')) {
    const code = token.slice(6).toUpperCase();
    return code ? { promoCode: code } : {};
  }
  if (token.startsWith('plan_')) {
    const slug = token.slice(5).toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug) ? { planSlug: slug } : {};
  }
  return {};
}

export function isReferralCode(value: string): boolean {
  return value.length === 8 && referralCodePattern.test(value);
}
