import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { SettingsService } from './settings.service';

type ActorRequest = FastifyRequest & { user?: { id?: string } };

function actorFrom(request: ActorRequest) {
  const id = request.user?.id;
  return id ? { id } : undefined;
}

@Controller('api/admin/v1/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings() {
    return this.settings.getAll(false);
  }

  @Put()
  async updateSettings(@Body() body: unknown, @Req() request: ActorRequest) {
    await this.settings.set(body, actorFrom(request));
    return this.settings.getAll(false);
  }

  @Get('schema')
  getSchema() {
    return { version: 1, settings: this.settings.schema() };
  }

  @Get('export')
  exportSettings() {
    return this.settings.exportSnapshot();
  }

  @Post('import')
  async importSettings(@Body() body: unknown, @Req() request: ActorRequest) {
    await this.settings.importSnapshot(body, actorFrom(request));
    return this.settings.getAll(false);
  }
}
