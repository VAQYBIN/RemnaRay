import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Permissions } from '../admin/admin.rbac';
import { Audit } from '../admin/audit.interceptor';
import { AuthGuard, InternalTokenGuard, type AuthenticatedRequest } from '../auth/auth.guards';
import { BroadcastsService } from './broadcasts.service';

@Controller('api/admin/v1/broadcasts')
@UseGuards(AuthGuard)
@Permissions('broadcasts.read')
export class AdminBroadcastsController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  @Get()
  list() {
    return this.broadcasts.list();
  }

  @Post()
  @HttpCode(201)
  @Permissions('broadcasts.write')
  @Audit('broadcasts.create', 'broadcast')
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.broadcasts.create(body, request.admin?.id ?? '');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.broadcasts.get(id);
  }

  @Patch(':id')
  @Permissions('broadcasts.write')
  @Audit('broadcasts.update', 'broadcast', 'id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.broadcasts.update(id, body);
  }

  @Delete(':id')
  @Permissions('broadcasts.write')
  @Audit('broadcasts.delete', 'broadcast', 'id')
  remove(@Param('id') id: string) {
    return this.broadcasts.remove(id);
  }

  @Post(':id/preview-segment')
  @HttpCode(200)
  previewSegment(@Param('id') id: string) {
    return this.broadcasts.previewSegment(id);
  }

  @Post(':id/test')
  @HttpCode(200)
  @Permissions('broadcasts.write')
  @Audit('broadcasts.test', 'broadcast', 'id')
  test(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.broadcasts.test(id, request.admin?.id ?? '');
  }

  @Post(':id/start')
  @HttpCode(200)
  @Permissions('broadcasts.write')
  @Audit('broadcasts.start', 'broadcast', 'id')
  start(@Param('id') id: string) {
    return this.broadcasts.start(id);
  }

  @Post(':id/pause')
  @HttpCode(200)
  @Permissions('broadcasts.write')
  @Audit('broadcasts.pause', 'broadcast', 'id')
  pause(@Param('id') id: string) {
    return this.broadcasts.setStatus(id, 'paused');
  }

  @Post(':id/resume')
  @HttpCode(200)
  @Permissions('broadcasts.write')
  @Audit('broadcasts.resume', 'broadcast', 'id')
  resume(@Param('id') id: string) {
    return this.broadcasts.start(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Permissions('broadcasts.write')
  @Audit('broadcasts.cancel', 'broadcast', 'id')
  cancel(@Param('id') id: string) {
    return this.broadcasts.setStatus(id, 'canceled');
  }

  @Get(':id/report')
  report(@Param('id') id: string) {
    return this.broadcasts.report(id);
  }

  @Get(':id/report.csv')
  async reportCsv(@Param('id') id: string, @Res() reply: FastifyReply) {
    const csv = await this.broadcasts.failuresCsv(id);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="broadcast-${id}-failed.csv"`)
      .send(csv);
  }
}

@Controller('api/internal/v1/broadcasts')
@UseGuards(InternalTokenGuard)
export class InternalBroadcastsController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  /** Queue consumer for `broadcast.chunk` (section 16.4). */
  @Post('chunk')
  @HttpCode(200)
  chunk(@Body() body: unknown) {
    return this.broadcasts.sendChunk(body);
  }
}
