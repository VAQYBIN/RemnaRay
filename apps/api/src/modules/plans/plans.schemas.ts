import { z } from 'zod';

const integerString = z
  .union([z.string().regex(/^\d+$/), z.number().int().refine(Number.isSafeInteger)])
  .transform((value) => BigInt(value));
const localized = z.record(z.enum(['ru', 'en']), z.string());
const description = z.record(z.enum(['ru', 'en']), z.string());
const trafficResetStrategy = z.enum(['NO_RESET', 'DAY', 'WEEK', 'MONTH']);
const priceOverrides = z.record(z.string(), z.unknown());
const mutablePlanFields = {
  name: localized,
  description,
  durationDays: z.number().int().min(1).max(3650),
  trafficLimitBytes: integerString,
  trafficResetStrategy,
  deviceLimit: z.number().int().min(0).max(100),
  // Section 8: `CHECK cardinality(squads) > 0` — the panel receives them as
  // the customer's `activeInternalSquads`.
  squads: z.array(z.uuid()).min(1),
  priceMinor: integerString,
  currency: z.string().regex(/^[A-Z]{3}$/),
  priceOverrides,
  isPublic: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1_000_000),
};

export const planInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  name: mutablePlanFields.name,
  description: description.default({ ru: '', en: '' }),
  durationDays: z.number().int().min(1).max(3650),
  trafficLimitBytes: integerString.default(0n),
  trafficResetStrategy: trafficResetStrategy.default('NO_RESET'),
  deviceLimit: z.number().int().min(0).max(100),
  squads: mutablePlanFields.squads,
  priceMinor: integerString,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('RUB'),
  priceOverrides: priceOverrides.default({}),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1_000_000).default(100),
});

export const planPatchSchema = z.object(mutablePlanFields).partial().strict();
export type PlanInput = z.infer<typeof planInputSchema>;
export type PlanPatch = z.infer<typeof planPatchSchema>;

export function jsonNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Plan amount exceeds JSON safe integer range');
  return number;
}

/**
 * Section 9.4 `PlanPublic`: `name` and `description` reach the site and the bot
 * with both locales. `plans.description` defaults to `{}`, and a name may carry
 * one locale only; a missing name falls back to the other locale, a missing
 * description to an empty text.
 */
export function planTexts(plan: { name: unknown; description: unknown }) {
  const name = localeText(plan.name);
  return {
    name: { ru: name.ru || name.en, en: name.en || name.ru },
    description: localeText(plan.description),
  };
}

function localeText(value: unknown): { ru: string; en: string } {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    ru: typeof record.ru === 'string' ? record.ru : '',
    en: typeof record.en === 'string' ? record.en : '',
  };
}
