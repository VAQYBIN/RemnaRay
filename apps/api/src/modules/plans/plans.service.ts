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

  update(id: string, value: unknown) {
    return this.repository.update(id, planPatchSchema.parse(value));
  }

  remove(id: string) {
    return this.repository.remove(id);
  }
}
