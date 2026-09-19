import { z } from 'zod';

import { localeTextSchema, moneySchema } from './common.js';

/** `PlanPublic` from section 9.4 — the only plan shape the public API exposes. */
export const planPublicSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: localeTextSchema,
  description: localeTextSchema,
  durationDays: z.number().int(),
  trafficLimitBytes: z.number().int(),
  deviceLimit: z.number().int(),
  price: moneySchema,
  sortOrder: z.number().int(),
});
export type PlanPublicView = z.infer<typeof planPublicSchema>;

export const planListSchema = z.object({ items: z.array(planPublicSchema) });
