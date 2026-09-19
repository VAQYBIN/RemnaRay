import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { PlansService } from './plans.service';
import { Permissions } from '../admin/admin.rbac';

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
  create(@Body() body: unknown) {
    return this.plans.create(body);
  }

  @Patch(':id')
  @Permissions('plans.write')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.plans.update(id, body);
  }

  @Delete(':id')
  @Permissions('plans.write')
  async remove(@Param('id') id: string) {
    await this.plans.remove(id);
    return { deleted: true };
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
