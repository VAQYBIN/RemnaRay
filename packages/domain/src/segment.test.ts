import { describe, expect, it } from 'vitest';

import { compileSegment, resolveDate, segmentOperators, segmentPresets } from './segment.js';

const now = new Date('2026-09-20T00:00:00.000Z');

describe('segment DSL', () => {
  it('always excludes banned, blocked, opted-out and anonymized users', () => {
    expect(compileSegment({ all: [] }, now).user).toEqual({
      isBanned: false,
      botBlockedAt: null,
      marketingOptOut: false,
      anonymizedAt: null,
    });
  });

  it('compiles every operator', () => {
    const compiled = {
      eq: compileSegment({ all: [{ field: 'user.language', op: 'eq', value: 'ru' }] }, now),
      ne: compileSegment({ all: [{ field: 'user.language', op: 'ne', value: 'ru' }] }, now),
      in: compileSegment({ all: [{ field: 'user.language', op: 'in', value: ['ru', 'en'] }] }, now),
      not_in: compileSegment(
        { all: [{ field: 'user.language', op: 'not_in', value: ['ru'] }] },
        now,
      ),
      lt: compileSegment({ all: [{ field: 'user.balance_minor', op: 'lt', value: 100 }] }, now),
      lte: compileSegment({ all: [{ field: 'user.balance_minor', op: 'lte', value: 100 }] }, now),
      gt: compileSegment({ all: [{ field: 'user.balance_minor', op: 'gt', value: 100 }] }, now),
      gte: compileSegment({ all: [{ field: 'user.balance_minor', op: 'gte', value: 100 }] }, now),
      null: compileSegment({ all: [{ field: 'user.trial_used_at', op: 'null' }] }, now),
      not_null: compileSegment({ all: [{ field: 'user.trial_used_at', op: 'not_null' }] }, now),
    };

    expect(Object.keys(compiled).sort()).toEqual([...segmentOperators].sort());
    expect(compiled.eq.user['language']).toBe('ru');
    expect(compiled.ne.user['language']).toEqual({ not: 'ru' });
    expect(compiled.in.user['language']).toEqual({ in: ['ru', 'en'] });
    expect(compiled.not_in.user['language']).toEqual({ notIn: ['ru'] });
    expect(compiled.lt.user['balanceMinor']).toEqual({ lt: 100 });
    expect(compiled.lte.user['balanceMinor']).toEqual({ lte: 100 });
    expect(compiled.gt.user['balanceMinor']).toEqual({ gt: 100 });
    expect(compiled.gte.user['balanceMinor']).toEqual({ gte: 100 });
    expect(compiled.null.user['trialUsedAt']).toBeNull();
    expect(compiled.not_null.user['trialUsedAt']).toEqual({ not: null });
  });

  it('resolves relative and absolute dates', () => {
    expect(resolveDate('now+3d', now).toISOString()).toBe('2026-09-23T00:00:00.000Z');
    expect(resolveDate('now-7d', now).toISOString()).toBe('2026-09-13T00:00:00.000Z');
    expect(resolveDate('now+12h', now).toISOString()).toBe('2026-09-20T12:00:00.000Z');
    expect(resolveDate('2026-09-01', now).toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(() => resolveDate('tomorrow', now)).toThrow();
  });

  it('separates subscription, plan, transaction and referrer conditions', () => {
    const plan = compileSegment(
      {
        all: [
          { field: 'subscription.status', op: 'in', value: ['active', 'grace'] },
          { field: 'subscription.expires_at', op: 'lte', value: 'now+3d' },
          { field: 'plan.slug', op: 'in', value: ['basic'] },
          { field: 'transactions.purchase_count', op: 'eq', value: 0 },
          { field: 'transactions.last_paid_at', op: 'gte', value: 'now-30d' },
          { field: 'user.referrer.code', op: 'eq', value: 'AB12CD' },
        ],
      },
      now,
    );

    expect(plan.subscription).toEqual([
      { field: 'status', value: { in: ['active', 'grace'] } },
      { field: 'expiresAt', value: { lte: new Date('2026-09-23T00:00:00.000Z') } },
      { field: 'planSlug', value: { in: ['basic'] } },
    ]);
    expect(plan.transactions).toEqual([
      { field: 'purchaseCount', value: 0 },
      { field: 'lastPaidAt', value: { gte: new Date('2026-08-21T00:00:00.000Z') } },
    ]);
    expect(plan.referrerCode).toBe('AB12CD');
  });

  it('never lets a segment widen the mandatory exclusions', () => {
    const plan = compileSegment(
      {
        all: [
          { field: 'user.is_banned', op: 'eq', value: true },
          { field: 'user.marketing_opt_out', op: 'eq', value: true },
          { field: 'user.bot_blocked_at', op: 'not_null' },
        ],
      },
      now,
    );

    expect(plan.user['isBanned']).toBe(false);
    expect(plan.user['marketingOptOut']).toBe(false);
    expect(plan.user['botBlockedAt']).toBeNull();
  });

  it('rejects an unknown field or operator', () => {
    expect(() =>
      compileSegment({ all: [{ field: 'user.email', op: 'eq', value: 'a' }] }),
    ).toThrow();
    expect(() =>
      compileSegment({ all: [{ field: 'user.language', op: 'like', value: 'a' }] }),
    ).toThrow();
  });

  it('ships the section 16.3 presets', () => {
    expect(Object.keys(segmentPresets)).toEqual([
      'all',
      'active',
      'expired_7d',
      'no_subscription',
      'trial_without_purchase',
      'expiring_3d',
    ]);
    for (const preset of Object.values(segmentPresets))
      expect(() => compileSegment(preset, now)).not.toThrow();
  });
});
