import { z } from 'zod';

/** Money is transported as `{ amountMinor, currency }` (section 9.1). */
export const moneySchema = z.object({
  amountMinor: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]).transform(BigInt),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type MoneyView = z.infer<typeof moneySchema>;

export const localeTextSchema = z.object({ ru: z.string(), en: z.string() });

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    messageKey: z.string().optional(),
    details: z.unknown().optional(),
    incidentId: z.string().optional(),
    requestId: z.string().optional(),
  }),
});

export function cursorPage<TItem extends z.ZodType>(item: TItem) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable().default(null) });
}
