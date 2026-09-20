import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { Infrastructure } from '../../infra/infra.module';
import { InternalTokenGuard } from '../auth/auth.guards';
import { NotifyService } from '../notify/notify.service';

const reloadResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().max(500).optional(),
});

/** Section 19.2: what `maintenance.tls-check` saw from the worker. */
const tlsResultSchema = z.object({
  host: z.string().min(1).max(253),
  reachable: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
  daysLeft: z.number().int().nullable(),
  error: z.string().max(200).optional(),
});

export const TLS_ALERT_DAYS = 14;
export const TLS_STATUS_KEY = 'rr:tls:status';

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

  @Post('tls-result')
  @HttpCode(200)
  async tlsResult(@Body() body: unknown) {
    const input = tlsResultSchema.parse(body);
    // Kept in Valkey rather than a settings key: it is an observation, not
    // configuration, and `/admin/system` is its only reader.
    await this.infra.redis
      .set(TLS_STATUS_KEY, JSON.stringify({ ...input, checkedAt: new Date().toISOString() }))
      .catch(() => null);

    const expiring = input.daysLeft !== null && input.daysLeft < TLS_ALERT_DAYS;
    if (expiring || !input.reachable)
      await this.notify.alert({
        type: 'tls.expiring',
        details: input.reachable
          ? `${input.host}: ${String(input.daysLeft)} d`
          : `${input.host}: ${input.error ?? 'unreachable'}`,
      });
    return { recorded: true, alerted: expiring || !input.reachable };
  }
}
