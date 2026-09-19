import { z } from 'zod';

/** Section 16.3 segment DSL. Conditions are joined with AND. */
export const segmentFields = [
  'user.language',
  'user.created_at',
  'user.trial_used_at',
  'user.marketing_opt_out',
  'user.is_banned',
  'user.bot_blocked_at',
  'user.balance_minor',
  'user.referrer.code',
  'subscription.status',
  'subscription.expires_at',
  'subscription.source',
  'plan.slug',
  'transactions.purchase_count',
  'transactions.last_paid_at',
] as const;
export type SegmentField = (typeof segmentFields)[number];

export const segmentOperators = [
  'eq',
  'ne',
  'in',
  'not_in',
  'lt',
  'lte',
  'gt',
  'gte',
  'null',
  'not_null',
] as const;
export type SegmentOperator = (typeof segmentOperators)[number];

export const segmentConditionSchema = z.object({
  field: z.enum(segmentFields),
  op: z.enum(segmentOperators),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
    .optional(),
});

export const segmentSchema = z.object({ all: z.array(segmentConditionSchema).max(20) });
export type Segment = z.infer<typeof segmentSchema>;
export type SegmentCondition = z.infer<typeof segmentConditionSchema>;

const RELATIVE = /^now([+-])(\d+)([dh])$/u;

/** `now±Nd/h` and ISO dates resolve to an absolute instant. */
export function resolveDate(value: unknown, now = new Date()): Date {
  if (value instanceof Date) return value;
  const text = String(value);
  const relative = RELATIVE.exec(text);
  if (relative) {
    const [, sign, amount, unit] = relative;
    const ms = Number(amount) * (unit === 'd' ? 86_400_000 : 3_600_000);
    return new Date(now.getTime() + (sign === '-' ? -ms : ms));
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid segment date: ${text}`);
  return parsed;
}

const DATE_FIELDS = new Set<SegmentField>([
  'user.created_at',
  'user.trial_used_at',
  'user.bot_blocked_at',
  'subscription.expires_at',
  'transactions.last_paid_at',
]);

const NUMBER_FIELDS = new Set<SegmentField>(['user.balance_minor', 'transactions.purchase_count']);

function coerce(field: SegmentField, value: unknown, now: Date): unknown {
  if (DATE_FIELDS.has(field)) return resolveDate(value, now);
  if (NUMBER_FIELDS.has(field)) return Number(value);
  return value;
}

function comparison(condition: SegmentCondition, now: Date): unknown {
  const { field, op, value } = condition;
  switch (op) {
    case 'eq':
      return coerce(field, value, now);
    case 'ne':
      return { not: coerce(field, value, now) };
    case 'in':
      return { in: (value as unknown[]).map((item) => coerce(field, item, now)) };
    case 'not_in':
      return { notIn: (value as unknown[]).map((item) => coerce(field, item, now)) };
    case 'lt':
      return { lt: coerce(field, value, now) };
    case 'lte':
      return { lte: coerce(field, value, now) };
    case 'gt':
      return { gt: coerce(field, value, now) };
    case 'gte':
      return { gte: coerce(field, value, now) };
    case 'null':
      return null;
    case 'not_null':
      return { not: null };
  }
}

export type SegmentPlan = {
  /** Conditions expressible directly on the `users` table. */
  user: Record<string, unknown>;
  /** Conditions the caller resolves against the live subscription. */
  subscription: { field: 'status' | 'expiresAt' | 'source' | 'planSlug'; value: unknown }[];
  /** Conditions the caller resolves against aggregated transactions. */
  transactions: { field: 'purchaseCount' | 'lastPaidAt'; value: unknown }[];
  referrerCode: string | null;
};

/**
 * Translates the DSL into a plan the broadcast repository executes. Everything
 * the `users` table can answer becomes a Prisma `where`; the rest is returned
 * separately because the schema has no Prisma relations.
 *
 * Section 16.3 always excludes banned, blocked, opted-out and anonymized users.
 */
export function compileSegment(input: unknown, now = new Date()): SegmentPlan {
  const segment = segmentSchema.parse(input);
  const plan: SegmentPlan = {
    user: {
      isBanned: false,
      botBlockedAt: null,
      marketingOptOut: false,
      anonymizedAt: null,
    },
    subscription: [],
    transactions: [],
    referrerCode: null,
  };

  for (const condition of segment.all) {
    const compiled = comparison(condition, now);
    switch (condition.field) {
      case 'user.language':
        plan.user['language'] = compiled;
        break;
      case 'user.created_at':
        plan.user['createdAt'] = compiled;
        break;
      case 'user.trial_used_at':
        plan.user['trialUsedAt'] = compiled;
        break;
      case 'user.marketing_opt_out':
      case 'user.is_banned':
      case 'user.bot_blocked_at':
        // The mandatory exclusions already pin these; a segment cannot widen them.
        break;
      case 'user.balance_minor':
        plan.user['balanceMinor'] = compiled;
        break;
      case 'user.referrer.code':
        plan.referrerCode = String(condition.value);
        break;
      case 'subscription.status':
        plan.subscription.push({ field: 'status', value: compiled });
        break;
      case 'subscription.expires_at':
        plan.subscription.push({ field: 'expiresAt', value: compiled });
        break;
      case 'subscription.source':
        plan.subscription.push({ field: 'source', value: compiled });
        break;
      case 'plan.slug':
        plan.subscription.push({ field: 'planSlug', value: compiled });
        break;
      case 'transactions.purchase_count':
        plan.transactions.push({ field: 'purchaseCount', value: compiled });
        break;
      case 'transactions.last_paid_at':
        plan.transactions.push({ field: 'lastPaidAt', value: compiled });
        break;
    }
  }
  return plan;
}

/** UI presets from section 16.3. */
export const segmentPresets: Record<string, Segment> = {
  all: { all: [] },
  active: { all: [{ field: 'subscription.status', op: 'in', value: ['active', 'grace'] }] },
  expired_7d: {
    all: [
      { field: 'subscription.status', op: 'eq', value: 'expired' },
      { field: 'subscription.expires_at', op: 'gte', value: 'now-7d' },
    ],
  },
  no_subscription: { all: [{ field: 'subscription.status', op: 'null' }] },
  trial_without_purchase: {
    all: [
      { field: 'user.trial_used_at', op: 'not_null' },
      { field: 'transactions.purchase_count', op: 'eq', value: 0 },
    ],
  },
  expiring_3d: {
    all: [
      { field: 'subscription.status', op: 'eq', value: 'active' },
      { field: 'subscription.expires_at', op: 'lte', value: 'now+3d' },
    ],
  },
};
