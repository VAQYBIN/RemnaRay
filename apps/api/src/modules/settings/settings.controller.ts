import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Infrastructure } from '../../infra/infra.module';
import { SettingsService } from './settings.service';
import { Permissions, Roles } from '../admin/admin.rbac';

type ActorRequest = FastifyRequest & { admin?: { id?: string } };

function actorFrom(request: ActorRequest) {
  const id = request.admin?.id;
  return id ? { id } : undefined;
}

@Controller('api/admin/v1/settings')
@Roles('admin')
@Permissions('settings.read')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly infra: Infrastructure,
  ) {}

  @Get()
  getSettings() {
    return this.settings.flat(false);
  }

  @Put()
  @Permissions('settings.write')
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
    const applied = Object.keys(patch);
    const channels = await this.settings.announce(applied, (channel, payload) =>
      this.infra.redis.publish(channel, payload),
    );
    const { restartRequired } = SettingsService.sideEffects(applied);
    return { applied, restartRequired, reconfigured: channels };
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
  @Permissions('settings.write')
  async importSettings(@Body() body: unknown, @Req() request: ActorRequest) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('json' in body)) {
      throw new Error('Settings import requires json');
    }
    const payload = body as { json: unknown; dryRun?: unknown };
    const input = payload.json;
    const dryRun = payload.dryRun === true;
    const diff = await this.settings.diff(input);
    if (dryRun) return { diff, dryRun: true };
    await this.settings.importSnapshot(input, actorFrom(request));
    await this.settings.announce(
      diff.map((row) => row.key),
      (channel, payload) => this.infra.redis.publish(channel, payload),
    );
    return { diff, dryRun: false };
  }
}
