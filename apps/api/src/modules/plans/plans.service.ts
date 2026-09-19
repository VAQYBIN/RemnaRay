import { Injectable } from '@nestjs/common';

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

  update(id: string, value: unknown) {
    return this.repository.update(id, planPatchSchema.parse(value));
  }

  remove(id: string) {
    return this.repository.remove(id);
  }
}
