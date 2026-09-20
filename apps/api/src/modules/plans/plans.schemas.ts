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
  squads: z.array(z.uuid()),
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
  description: description.default({} as Record<'ru' | 'en', string>),
  durationDays: z.number().int().min(1).max(3650),
  trafficLimitBytes: integerString.default(0n),
  trafficResetStrategy: trafficResetStrategy.default('NO_RESET'),
  deviceLimit: z.number().int().min(0).max(100),
  squads: z.array(z.uuid()),
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
