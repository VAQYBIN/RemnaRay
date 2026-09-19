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
