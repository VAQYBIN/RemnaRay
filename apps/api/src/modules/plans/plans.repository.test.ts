import { describe, expect, it, vi } from 'vitest';

import { PlansRepository } from './plans.repository';

const row = {
  id: 'plan-1',
  slug: 'month',
  name: { ru: 'Месяц' },
  description: {},
  durationDays: 30,
  trafficLimitBytes: 0n,
  trafficResetStrategy: 'NO_RESET',
  deviceLimit: 3,
  squads: ['00000000-0000-4000-8000-000000000001'],
  priceMinor: 29900n,
  currency: 'RUB',
  priceOverrides: {},
  isPublic: true,
  isActive: true,
  sortOrder: 10,
  deletedAt: null,
};

describe('PlansRepository views (section 9.4 PlanPublic)', () => {
  it('gives every plan a name and description in each locale', async () => {
    const prisma = { plan: { findMany: vi.fn().mockResolvedValue([row]) } };
    const redis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const repository = new PlansRepository(prisma as never, redis as never);

    const [plan] = await repository.list(false);

    // `plans.description` defaults to `{}`; the site's contract reads both
    // locales and refused the whole list without them.
    expect(plan?.description).toEqual({ ru: '', en: '' });
    expect(plan?.name).toEqual({ ru: 'Месяц', en: 'Месяц' });
  });
});
