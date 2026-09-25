import { z } from 'zod';

import { cursorPage, localeTextSchema, moneySchema } from './common.js';
import { planPublicSchema } from './plans.js';

export const userMeSchema = z.object({
  id: z.string(),
  telegramId: z.number(),
  username: z.string().nullable(),
  firstName: z.string().nullable(),
  language: z.string(),
  email: z.string().nullable(),
  /** Section 15.2: what can be spent, `balance_minor − SUM(held rewards)`. */
  balance: moneySchema,
  /** Referral rewards still held for a possible reversal, shown as pending. */
  balanceHeld: moneySchema,
  referralCode: z.string(),
  referralLink: z.string(),
  botReferralLink: z.string(),
  marketingOptOut: z.boolean(),
  trialAvailable: z.boolean(),
  createdAt: z.string(),
});
export type UserMeView = z.infer<typeof userMeSchema>;

export const subscriptionViewSchema = z.object({
  id: z.string(),
  status: z.string(),
  source: z.string(),
  plan: planPublicSchema.nullable(),
  startsAt: z.string(),
  expiresAt: z.string(),
  daysLeft: z.number(),
  canChangePlan: z.boolean(),
  canRevoke: z.boolean(),
});

export const clientLinkSchema = z.object({
  id: z.string(),
  name: z.string(),
  platforms: z.array(z.string()),
  deepLink: z.string().nullable(),
  storeUrls: z.record(z.string(), z.string()).default({}),
});

export const subscriptionStateSchema = z.object({
  subscription: subscriptionViewSchema.nullable(),
  panel: z
    .object({
      status: z.string(),
      usedTrafficBytes: z.number(),
      trafficLimitBytes: z.number(),
      expireAt: z.string().nullable(),
      deviceLimit: z.number().nullable(),
      subscriptionUrl: z.string(),
    })
    .nullable(),
  clients: z.array(clientLinkSchema),
});
export type SubscriptionStateView = z.infer<typeof subscriptionStateSchema>;

export const deviceListSchema = z.object({
  items: z.array(
    z.object({
      hwid: z.string(),
      platform: z.string().nullable(),
      osVersion: z.string().nullable(),
      deviceModel: z.string().nullable(),
      createdAt: z.string().nullable(),
    }),
  ),
  canRemove: z.boolean(),
});
export type DeviceListView = z.infer<typeof deviceListSchema>;

export const paymentMethodsSchema = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      displayName: z.union([localeTextSchema, z.record(z.string(), z.string())]),
      kind: z.enum(['redirect', 'stars', 'balance']),
      available: z.boolean(),
      unavailableReason: z.string().optional(),
      balance: moneySchema.optional(),
    }),
  ),
});
export type PaymentMethodsView = z.infer<typeof paymentMethodsSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  terminal: z.boolean(),
  plan: planPublicSchema.nullable(),
  provider: z.string(),
  amount: moneySchema,
  discount: moneySchema,
  providerAmount: z.object({ amount: z.string(), currency: z.string() }).optional(),
  paymentUrl: z.string().optional(),
  starsInvoiceLink: z.string().optional(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type InvoiceView = z.infer<typeof invoiceSchema>;

export const transactionsSchema = cursorPage(
  z.object({
    id: z.string(),
    type: z.string(),
    amount: moneySchema,
    provider: z.string().nullable(),
    status: z.string(),
    createdAt: z.string(),
    description: z.string().nullable(),
  }),
);
export type TransactionsView = z.infer<typeof transactionsSchema>;

export const referralsSchema = z.object({
  code: z.string(),
  link: z.string(),
  botLink: z.string(),
  invited: z.number(),
  converted: z.number(),
  earned: moneySchema,
  program: z.object({
    mode: z.string(),
    percent: z.number(),
    fixedMinor: z.number(),
    inviteeBonus: z.number(),
  }),
});
export type ReferralsView = z.infer<typeof referralsSchema>;

export const referralListSchema = cursorPage(
  z.object({
    maskedName: z.string(),
    joinedAt: z.string(),
    status: z.string(),
    rewardMinor: z.number(),
  }),
);

export const trialResultSchema = z.object({
  subscription: z.unknown(),
  status: z.string(),
});

export const revokeResultSchema = z.object({ subscriptionUrl: z.string() });

export const anonymizationRequestSchema = z.object({
  requested: z.boolean(),
  requestedAt: z.string(),
});

export const topupConfigSchema = z.object({
  presetsMinor: z.array(z.number()),
  minMinor: z.number(),
  maxMinor: z.number(),
});

export const planChangeQuoteSchema = z.object({
  creditMinor: z.number(),
  newPriceMinor: z.number(),
  toPayMinor: z.number(),
  canPayFromBalance: z.boolean(),
});

export const promocodePreviewSchema = z.object({
  discountMinor: z.number(),
  finalMinor: z.number(),
});
