import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { PlansService } from './plans.service';

@Controller('api/admin/v1/plans')
export class PlansAdminController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.plans.list(includeInactive === 'true');
  }

  @Post()
  create(@Body() body: unknown) {
    return this.plans.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.plans.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.plans.remove(id);
    return { deleted: true };
  }
}

@Controller('api/v1/public/plans')
export class PublicPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.list(false).then((items) => ({ items }));
  }
}
