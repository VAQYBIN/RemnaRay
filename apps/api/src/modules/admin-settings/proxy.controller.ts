import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
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

/** Section 20.3: what `maintenance.backup-check` saw in `.last-status`. */
const backupResultSchema = z.object({
  ok: z.boolean(),
  state: z.string().min(1).max(40),
  at: z.iso.datetime().nullable(),
  file: z.string().max(200).nullable(),
  sizeBytes: z.number().int().min(0),
  ageHours: z.number().nullable(),
});

export const TLS_ALERT_DAYS = 14;
export const TLS_STATUS_KEY = 'rr:tls:status';
export const BACKUP_STATUS_KEY = 'rr:backup:status';

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

  @Post('backup-result')
  @HttpCode(200)
  async backupResult(@Body() body: unknown) {
    const input = backupResultSchema.parse(body);
    await this.infra.redis
      .set(BACKUP_STATUS_KEY, JSON.stringify({ ...input, checkedAt: new Date().toISOString() }))
      .catch(() => null);

    if (!input.ok)
      await this.notify.alert({
        type: 'backup.failed',
        details:
          input.ageHours === null
            ? input.state
            : `${input.state}, ${input.ageHours.toFixed(1)} h old`,
      });
    return { recorded: true, alerted: !input.ok };
  }
}

/**
 * Section 21.5: the proxy invariant is checked by comparing what reaches the
 * upstream under each profile, so the upstream has to be able to say what it
 * received. The endpoint exists only when `RR_ECHO_HEADERS=true`, which the
 * smoke stand of section 22.7 sets and a deployment never does; without it the
 * route answers 404 like any path the application does not serve.
 */
@Controller('api/internal/v1')
@UseGuards(InternalTokenGuard)
export class InternalEchoController {
  @Post('echo-headers')
  @HttpCode(200)
  echo(@Req() request: FastifyRequest) {
    if (process.env.RR_ECHO_HEADERS !== 'true') throw new NotFoundException('NOT_FOUND');
    const header = (name: string) => {
      const value = request.headers[name];
      return (Array.isArray(value) ? value[0] : value) ?? null;
    };
    return {
      host: header('host'),
      // `request.ip` is the address Fastify resolved through
      // `RR_TRUSTED_PROXIES`; the raw headers are what the proxy actually sent.
      clientIp: request.ip,
      protocol: request.protocol,
      forwardedFor: header('x-forwarded-for'),
      forwardedProto: header('x-forwarded-proto'),
      forwardedHost: header('x-forwarded-host'),
      realIp: header('x-real-ip'),
      requestId: header('x-request-id'),
    };
  }
}
