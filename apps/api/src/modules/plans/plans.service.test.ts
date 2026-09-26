import { describe, expect, it } from 'vitest';

import { PlansService } from './plans.service';
import type { PlansRepositoryPort } from './plans.repository';

class MemoryPlans implements PlansRepositoryPort {
  creates = 0;
  create(input: Parameters<PlansRepositoryPort['create']>[0]) {
    this.creates += 1;
    return Promise.resolve({ ...input, id: 'plan-1' } as never);
  }
  list() {
    return Promise.resolve([]);
  }
  update() {
    return Promise.reject(new Error('unused'));
  }
  remove() {
    return Promise.resolve();
  }
  reordered: string[] = [];
  reorder(ids: string[]) {
    this.reordered = ids;
    return Promise.resolve([]);
  }
}

describe('PlansService', () => {
  it('validates an admin create payload before reaching the repository', async () => {
    const repository = new MemoryPlans();
    const service = new PlansService(repository);
    await service.create({
      slug: 'starter',
      name: { ru: 'Старт', en: 'Starter' },
      durationDays: 7,
      deviceLimit: 1,
      squads: ['00000000-0000-4000-8000-000000000001'],
      priceMinor: 5000,
    });
    expect(repository.creates).toBe(1);
    expect(() => service.create({ slug: 'bad slug' })).toThrow();
  });

  it('refuses a plan without panel squads (section 8 CHECK cardinality(squads) > 0)', async () => {
    const repository = new MemoryPlans();
    const service = new PlansService(repository);
    const plan = {
      slug: 'starter',
      name: { ru: 'Старт', en: 'Starter' },
      durationDays: 7,
      deviceLimit: 1,
      squads: [],
      priceMinor: 5000,
    };
    // The panel receives the squads as `activeInternalSquads`: none would
    // take every squad away from the customers who buy the plan.
    expect(() => service.create(plan)).toThrow();
    await expect(service.update('plan-1', { squads: [] })).rejects.toThrow();
    expect(repository.creates).toBe(0);
  });

  it('passes a reorder list straight to the repository', async () => {
    const repository = new MemoryPlans();
    await new PlansService(repository).reorder(['a', 'b']);
    expect(repository.reordered).toEqual(['a', 'b']);
  });

  it('refuses to put a plan without squads on sale (migration 0009)', async () => {
    const repository = new MemoryPlans();
    repository.list = () => Promise.resolve([{ id: 'legacy', squads: [] } as never]);
    let updated = 0;
    repository.update = () => {
      updated += 1;
      return Promise.resolve({} as never);
    };
    const service = new PlansService(repository);

    await expect(service.update('legacy', { isActive: true })).rejects.toMatchObject({
      response: { error: { code: 'VALIDATION_ERROR' } },
    });
    // Taking it off sale, or giving it squads, still works.
    await service.update('legacy', { isActive: false });
    await service.update('legacy', {
      isActive: true,
      squads: ['00000000-0000-4000-8000-000000000001'],
    });
    expect(updated).toBe(2);
  });
});
