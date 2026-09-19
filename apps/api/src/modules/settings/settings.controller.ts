import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { SettingsService } from './settings.service';
import { Roles } from '../admin/admin.rbac';

type ActorRequest = FastifyRequest & { user?: { id?: string } };

function actorFrom(request: ActorRequest) {
  const id = request.user?.id;
  return id ? { id } : undefined;
}

@Controller('api/admin/v1/settings')
@Roles('admin')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings() {
    return this.settings.flat(false);
  }

  @Put()
  async updateSettings(@Body() body: unknown, @Req() request: ActorRequest) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('patch' in body)) {
      throw new Error('Settings update requires a patch object');
    }
    const patch = body.patch;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('Settings patch must be an object');
    }
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(patch)) {
      const separator = key.indexOf('.');
      if (separator < 1) throw new Error(`Invalid setting key: ${key}`);
      const group = key.slice(0, separator);
      const name = key.slice(separator + 1);
      grouped[group] ??= {};
      grouped[group][name] = value;
    }
    await this.settings.set(grouped, actorFrom(request));
    return { applied: Object.keys(patch), restartRequired: [] };
  }

  @Get('schema')
  getSchema() {
    return this.settings.schemaJson();
  }

  @Get('export')
  exportSettings() {
    return this.settings.exportSnapshot();
  }

  @Post('import')
  async importSettings(@Body() body: unknown, @Req() request: ActorRequest) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('json' in body)) {
      throw new Error('Settings import requires json');
    }
    const payload = body as { json: unknown; dryRun?: unknown };
    const input = payload.json;
    const dryRun = payload.dryRun === true;
    if (dryRun) {
      return { diff: [], dryRun: true };
    }
    await this.settings.importSnapshot(input, actorFrom(request));
    return { diff: [], dryRun: false };
  }
}
