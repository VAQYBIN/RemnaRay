import { z } from 'zod';

import { segmentSchema } from '@remnaray/domain';

/** Section 16.3: only these Telegram HTML tags are accepted. */
const ALLOWED_TAGS = ['b', 'i', 'u', 's', 'code', 'pre', 'a', 'tg-spoiler', 'blockquote'];
const TAG = /<\/?([a-z-]+)(?:\s[^>]*)?>/giu;

export function assertTelegramHtml(text: string): void {
  for (const match of text.matchAll(TAG)) {
    const tag = (match[1] ?? '').toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) throw new Error(`Unsupported HTML tag: <${tag}>`);
  }
}

const localizedText = z
  .object({
    ru: z.string().min(1).max(4000).optional(),
    en: z.string().min(1).max(4000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one language is required.',
  })
  .superRefine((value, ctx) => {
    for (const text of Object.values(value)) {
      if (typeof text !== 'string') continue;
      try {
        assertTelegramHtml(text);
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: String(error) });
      }
    }
  });

export const broadcastButtonSchema = z.object({
  text: z.string().min(1).max(64),
  type: z.enum(['url', 'deeplink', 'callback']),
  value: z.string().min(1).max(256),
});

export const broadcastContentSchema = z.object({
  text: localizedText,
  buttons: z.array(broadcastButtonSchema).max(4).default([]),
  photo: z.string().max(512).nullable().default(null),
});

export const broadcastInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: broadcastContentSchema,
  segment: segmentSchema,
  scheduledAt: z.iso.datetime().nullable().default(null),
});

export const broadcastPatchSchema = broadcastInputSchema.partial().extend({
  reason: z.string().min(3).max(500).optional(),
});

export type BroadcastContent = z.infer<typeof broadcastContentSchema>;
export type BroadcastButton = z.infer<typeof broadcastButtonSchema>;
