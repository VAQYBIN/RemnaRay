import { z } from 'zod';

import { serverApi } from './api';

export const publicConfigSchema = z.object({
  brand: z.object({
    name: z.string(),
    slogan: z.object({ ru: z.string(), en: z.string() }),
    supportContact: z.string(),
    botUsername: z.string(),
    hidePoweredBy: z.boolean(),
  }),
  locales: z.object({ default: z.string(), enabled: z.array(z.string()) }),
  currency: z.string(),
  features: z.object({
    trial: z.object({ enabled: z.boolean(), days: z.number() }),
    topup: z.boolean(),
    referral: z.boolean(),
    promo: z.boolean(),
  }),
  clients: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      platforms: z.array(z.string()),
      deepLinkTemplate: z.string().optional(),
      storeUrls: z.record(z.string(), z.string()).default({}),
    }),
  ),
  legal: z.object({
    termsUpdatedAt: z.string().nullable(),
    privacyUpdatedAt: z.string().nullable(),
  }),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

/** AC-181: a settings override must reach the site within five seconds. */
export const CONFIG_REVALIDATE_SECONDS = 5;

const fallback: PublicConfig = {
  brand: {
    name: 'RemnaRay',
    slogan: { ru: '', en: '' },
    supportContact: '',
    botUsername: '',
    hidePoweredBy: false,
  },
  locales: { default: 'ru', enabled: ['ru', 'en'] },
  currency: 'RUB',
  features: {
    trial: { enabled: false, days: 0 },
    topup: false,
    referral: false,
    promo: true,
  },
  clients: [],
  legal: { termsUpdatedAt: null, privacyUpdatedAt: null },
};

export async function getPublicConfig(): Promise<PublicConfig> {
  try {
    return await serverApi().get('api/v1/public/config', publicConfigSchema, {
      next: { revalidate: CONFIG_REVALIDATE_SECONDS, tags: ['config'] },
    });
  } catch {
    return fallback;
  }
}
