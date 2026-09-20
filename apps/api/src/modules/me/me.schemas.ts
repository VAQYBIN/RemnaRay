import { z } from 'zod';

export const profilePatchSchema = z
  .object({
    language: z.enum(['ru', 'en']).optional(),
    email: z.email().max(254).nullable().optional(),
    marketingOptOut: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update.' });

export const invoiceCreateSchema = z.object({
  kind: z.enum(['purchase', 'topup', 'plan_change']),
  planId: z.uuid().optional(),
  provider: z.string().min(1).max(32),
  amountMinor: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  promocode: z.string().min(3).max(64).optional(),
});

export const promocodeSchema = z.object({ code: z.string().min(3).max(64) });
export const promocodePreviewSchema = promocodeSchema.extend({ planId: z.uuid() });
export const planIdQuerySchema = z.object({ planId: z.uuid() });
export const cursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});

export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;
