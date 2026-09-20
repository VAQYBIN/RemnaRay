import { z } from 'zod';

import { planInputSchema } from '../plans/plans.schemas';

const locale = z.enum(['ru', 'en']);
const host = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/iu);

/** Section 17.4 step 0. */
export const setupTokenSchema = z.object({ token: z.string().min(1).max(512) });

/**
 * Step 1. The wizard posts the same step twice: without `code` the server
 * generates the TOTP secret and answers with the QR, with `code` it confirms
 * the enrolment and creates the administrator.
 */
export const setupAdminSchema = z
  .object({
    email: z.email().max(200),
    password: z.string().min(12).max(200),
    passwordConfirm: z.string().min(12).max(200),
    code: z
      .string()
      .regex(/^\d{6}$/u)
      .optional(),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Passwords do not match',
  });

/** Step 2. */
export const setupDomainSchema = z.object({
  main: host,
  acmeEmail: z.email().max(200).or(z.literal('')),
  extraDomains: z.array(host).max(10).default([]),
});

/** Step 3, and the «Проверить» button next to it. */
export const setupPanelSchema = z.object({
  baseUrl: z.url().max(300),
  apiToken: z.string().min(1).max(4096),
  extraHeaders: z.record(z.string().min(1).max(100), z.string().max(1000)).default({}),
});

/** Step 4, and its «Проверить» button. */
export const setupBotCheckSchema = z.object({ token: z.string().min(10).max(200) });
export const setupBotSchema = setupBotCheckSchema.extend({
  mode: z.enum(['webhook', 'polling']).default('webhook'),
  supportContact: z.string().min(1).max(200),
  adminLanguage: locale.default('ru'),
});

/** Step 5. */
export const setupBrandSchema = z
  .object({
    name: z.string().min(1).max(100),
    slogan: z.object({ ru: z.string().max(200), en: z.string().max(200) }),
    defaultLocale: locale,
    enabledLocales: z.array(locale).min(1),
    timezone: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Unknown IANA timezone'),
    themeSlug: z.string().regex(/^(?:_admin|[a-z0-9]+(?:-[a-z0-9]+)*)$/u),
  })
  .refine((value) => value.enabledLocales.includes(value.defaultLocale), {
    path: ['defaultLocale'],
    message: 'The default locale must be enabled',
  });

/** Step 6: the first plan plus the trial parameters of section 17.3. */
export const setupPlanSchema = z.object({
  plan: planInputSchema,
  trial: z.object({
    enabled: z.boolean(),
    days: z.number().int().min(0).max(3650),
    traffic_gb: z.number().int().min(0).max(1_000_000),
    device_limit: z.number().int().min(0).max(100),
    squads: z.array(z.uuid()).default([]),
  }),
});

/** Step 7, and the «Проверить» button of each provider. */
export const setupProviderCheckSchema = z.object({
  code: z.string().min(1).max(50),
  config: z.record(z.string().min(1).max(100), z.unknown()).default({}),
});
export const setupPaymentsSchema = z.object({
  skipped: z.boolean().default(false),
  providers: z
    .array(
      setupProviderCheckSchema.extend({
        enabled: z.boolean().default(true),
        displayName: z.object({ ru: z.string().min(1), en: z.string().min(1) }).optional(),
      }),
    )
    .max(20)
    .default([]),
  fiscal: z
    .object({
      mode: z.enum(['none', 'receipt', 'manual']).default('none'),
      self_employed: z.boolean().default(false),
      vat_code: z.number().int().min(1).max(10).default(1),
      sno: z.string().min(1).max(20).default('npd'),
      fallback_email: z.email().max(200).or(z.literal('')).default(''),
    })
    .default(() => ({
      mode: 'none' as const,
      self_employed: false,
      vat_code: 1,
      sno: 'npd',
      fallback_email: '',
    })),
});

export const setupStepBodies = {
  '1': setupAdminSchema,
  '2': setupDomainSchema,
  '3': setupPanelSchema,
  '4': setupBotSchema,
  '5': setupBrandSchema,
  '6': setupPlanSchema,
  '7': setupPaymentsSchema,
} as const;

export type SetupStep = keyof typeof setupStepBodies;
export const SETUP_STEPS = Object.keys(setupStepBodies) as SetupStep[];
