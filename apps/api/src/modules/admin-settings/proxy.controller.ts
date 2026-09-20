import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { Infrastructure } from '../../infra/infra.module';
import { InternalTokenGuard } from '../auth/auth.guards';
import { NotifyService } from '../notify/notify.service';

const reloadResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().max(500).optional(),
});

/**
 * Section 21.6: `proxy-reloader` reports every apply here, so the outcome is
 * in `audit_log` and a refused configuration raises `proxy.config_invalid`.
 */
@Controller('api/internal/v1/system')
@UseGuards(InternalTokenGuard)
export class InternalProxyController {
  constructor(
    private readonly infra: Infrastructure,
    private readonly notify: NotifyService,
  ) {}

  @Post('proxy-reload-result')
  @HttpCode(200)
  async reloadResult(@Body() body: unknown) {
    const input = reloadResultSchema.parse(body);
    await this.infra.db.auditLog.create({
      data: {
        actorType: 'system',
        action: 'proxy.reload',
        entity: 'proxy',
        after: { ok: input.ok, ...(input.error ? { error: input.error } : {}) } as never,
      },
    });
    if (!input.ok)
      await this.notify.alert({
        type: 'proxy.config_invalid',
        ...(input.error ? { details: input.error } : {}),
      });
    return { recorded: true };
  }
}
