import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(1024),
});

export const adminTotpSchema = z.object({
  challengeId: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code: z.string().regex(/^\d{6}$/),
});

export const adminChallengeSchema = z.object({
  challengeId: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminTotpInput = z.infer<typeof adminTotpSchema>;

const password = z
  .string()
  .min(12)
  .max(1024)
  .regex(/[a-z]/u, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/u, 'Password must contain an uppercase letter.')
  .regex(/\d/u, 'Password must contain a digit.');

export const adminCreateSchema = z.object({
  email: z.email(),
  password,
  role: z.enum(['admin', 'operator']),
  telegramId: z
    .union([z.string().regex(/^\d{1,19}$/), z.number().int().positive(), z.null()])
    .optional(),
});

export const adminUpdateSchema = z
  .object({
    role: z.enum(['admin', 'operator']).optional(),
    telegramId: z
      .union([z.string().regex(/^\d{1,19}$/), z.number().int().positive(), z.null()])
      .optional(),
    isActive: z.boolean().optional(),
    reason: z.string().min(3).max(500),
  })
  .refine(
    (value) =>
      value.role !== undefined || value.telegramId !== undefined || value.isActive !== undefined,
    { message: 'At least one field must change.' },
  );

export const adminResetPasswordSchema = z.object({ password });
export const adminReasonSchema = z.object({ reason: z.string().min(3).max(500) });

export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
