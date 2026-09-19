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
      squads: [],
      priceMinor: 5000,
    });
    expect(repository.creates).toBe(1);
    expect(() => service.create({ slug: 'bad slug' })).toThrow();
  });
});
