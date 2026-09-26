import { HttpStatus, Injectable } from '@nestjs/common';

import { ApiError } from '../me/me.errors';

import { planInputSchema, planPatchSchema } from './plans.schemas';
import type { PlansRepositoryPort } from './plans.repository';

@Injectable()
export class PlansService {
  constructor(private readonly repository: PlansRepositoryPort) {}

  create(value: unknown) {
    return this.repository.create(planInputSchema.parse(value));
  }

  list(includeInactive = false) {
    return this.repository.list(includeInactive);
  }

  /** `PlanPublic` projection from section 9.4 — no squads, no internal flags. */
  async publicList() {
    const plans = await this.repository.list(false);
    return plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      durationDays: plan.durationDays,
      trafficLimitBytes: plan.trafficLimitBytes,
      deviceLimit: plan.deviceLimit,
      price: plan.price,
      sortOrder: plan.sortOrder,
    }));
  }

  async update(id: string, value: unknown) {
    const patch = planPatchSchema.parse(value);
    // Migration 0009 allows empty squads only on a plan that cannot be sold:
    // activating one without squads is a field error, not a database fault.
    if (patch.isActive === true && patch.squads === undefined) {
      const current = (await this.repository.list(true)).find((plan) => plan.id === id);
      if (current && current.squads.length === 0)
        throw new ApiError(
          'VALIDATION_ERROR',
          HttpStatus.BAD_REQUEST,
          'A plan needs at least one squad to be on sale',
          [{ path: 'squads', message: 'A plan needs at least one squad to be on sale' }],
        );
    }
    return this.repository.update(id, patch);
  }

  remove(id: string) {
    return this.repository.remove(id);
  }

  reorder(ids: string[]) {
    return this.repository.reorder(ids);
  }
}
