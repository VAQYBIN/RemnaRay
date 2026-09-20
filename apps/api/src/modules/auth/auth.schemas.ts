import { z } from 'zod';

export const telegramWidgetSchema = z.object({
  id: z.union([z.string().regex(/^\d+$/), z.number().int().refine(Number.isSafeInteger)]),
  first_name: z.string().min(1).max(255),
  last_name: z.string().max(255).optional(),
  username: z.string().max(255).optional(),
  photo_url: z.url().optional(),
  auth_date: z.union([z.string().regex(/^\d+$/), z.number().int()]),
  hash: z.string().regex(/^[a-f0-9]{64}$/i),
  language_code: z.string().max(16).optional(),
});

export type TelegramWidgetInput = z.infer<typeof telegramWidgetSchema>;

export const issueTokenSchema = z.object({
  telegramId: z.union([z.string().regex(/^\d+$/), z.number().int().refine(Number.isSafeInteger)]),
});
