import { describe, expect, it } from 'vitest';

import { planInputSchema, planPatchSchema } from './plans.schemas';

const valid = {
  slug: 'pro-30',
  name: { ru: 'Про', en: 'Pro' },
  durationDays: 30,
  deviceLimit: 3,
  squads: ['01a0b9f0-e699-7032-9841-6d516d4591ad'],
  priceMinor: '29900',
};

describe('plans schemas', () => {
  it('normalizes minor units and supplies safe defaults', () => {
    const plan = planInputSchema.parse(valid);
    expect(plan.priceMinor).toBe(29900n);
    expect(plan.currency).toBe('RUB');
    expect(plan.isPublic).toBe(true);
    expect(plan.trafficLimitBytes).toBe(0n);
  });

  it('does not allow changing a slug through a patch', () => {
    expect(planPatchSchema.safeParse({ slug: 'new-slug', isActive: false }).success).toBe(false);
    expect(planPatchSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});
