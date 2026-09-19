import { z } from 'zod';

export const reason = z.string().min(3).max(500);

export const userListQuerySchema = z.object({
  q: z.string().min(1).max(64).optional(),
  status: z.enum(['provisioning', 'active', 'grace', 'expired', 'revoked', 'none']).optional(),
  referrerId: z.uuid().optional(),
  createdFrom: z.iso.datetime().optional(),
  createdTo: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});

export const extendSchema = z.object({ days: z.number().int().min(1).max(3650), reason });
export const setPlanSchema = z.object({
  planId: z.uuid(),
  keepExpiry: z.boolean().default(false),
  reason,
});
export const balanceSchema = z.object({
  amountMinor: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]).transform(BigInt),
  reason,
});
export const reasonSchema = z.object({ reason });
export const messageSchema = z.object({
  text: z.string().min(1).max(4000),
  lang: z.enum(['ru', 'en']).optional(),
});
export const notesSchema = z.object({ notes: z.string().max(4000).nullable() });

export const bulkExtendSchema = z.object({
  subscriptionIds: z.array(z.uuid()).min(1).max(500),
  days: z.number().int().min(1).max(3650),
  reason,
});

export const refundSchema = z.object({
  amountMinor: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(BigInt),
  reason,
});

export const reorderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(200) });
