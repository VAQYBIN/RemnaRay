import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { PlansService } from './plans.service';
import { Permissions } from '../admin/admin.rbac';
import { Audit, Audited } from '../admin/audit.interceptor';
import { reorderSchema } from '../admin-api/admin-users.schemas';

@Controller('api/admin/v1/plans')
@Permissions('plans.read')
export class PlansAdminController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.plans.list(includeInactive === 'true');
  }

  @Post()
  @Permissions('plans.write')
  @Audit('plans.create', 'plan')
  async create(@Body() body: unknown) {
    return new Audited(null, await this.plans.create(body));
  }

  @Post('reorder')
  @Permissions('plans.write')
  @Audit('plans.reorder', 'plan')
  async reorder(@Body() body: unknown) {
    const before = await this.plans.list(true);
    const after = await this.plans.reorder(reorderSchema.parse(body).ids);
    return new Audited(
      before.map((plan) => ({ id: plan.id, sortOrder: plan.sortOrder })),
      after.map((plan) => ({ id: plan.id, sortOrder: plan.sortOrder })),
      { items: after },
    );
  }

  @Patch(':id')
  @Permissions('plans.write')
  @Audit('plans.update', 'plan', 'id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const before = (await this.plans.list(true)).find((plan) => plan.id === id) ?? null;
    return new Audited(before, await this.plans.update(id, body));
  }

  @Delete(':id')
  @Permissions('plans.write')
  @Audit('plans.delete', 'plan', 'id')
  async remove(@Param('id') id: string) {
    const before = (await this.plans.list(true)).find((plan) => plan.id === id) ?? null;
    await this.plans.remove(id);
    return new Audited(before, { deletedAt: new Date().toISOString() }, { deleted: true });
  }
}

@Controller('api/v1/public/plans')
export class PublicPlansController {
  constructor(private readonly plans: PlansService) {}

  /** Section 9.4 exposes `PlanPublic` only: squads and flags stay internal. */
  @Get()
  async list() {
    return { items: await this.plans.publicList() };
  }
}
