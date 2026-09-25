import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

import { QUEUE_NAMES } from '@remnaray/queues';

import { Infrastructure } from '../../infra/infra.module';
import { Audited } from '../admin/audit.interceptor';
import { RemnawaveService } from '../remnawave/remnawave.service';
import { SettingsService } from '../settings/settings.service';
import { caddyHasRateLimit } from '../../tools/proxy-render';
import { ForwardedObserver } from './forwarded.interceptor';
import { BACKUP_STATUS_KEY, DISK_STATUS_KEY, TLS_STATUS_KEY } from './proxy.controller';

function appVersion(): string {
  if (process.env.RR_APP_VERSION) return process.env.RR_APP_VERSION;
  try {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return manifest.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** FR-146 health page. */
@Injectable()
export class SystemService {
  constructor(
    private readonly infra: Infrastructure,
    private readonly settings: SettingsService,
    private readonly panel: RemnawaveService,
    private readonly forwarded: ForwardedObserver,
  ) {}

  /** The last `maintenance.tls-check` reading (section 19.2). */
  private async tlsStatus(): Promise<{
    expiresAt: string | null;
    daysLeft: number | null;
    checkedAt: string | null;
  }> {
    const raw = await this.infra.redis.get(TLS_STATUS_KEY).catch(() => null);
    if (!raw) return { expiresAt: null, daysLeft: null, checkedAt: null };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      expiresAt: typeof parsed['expiresAt'] === 'string' ? parsed['expiresAt'] : null,
      daysLeft: typeof parsed['daysLeft'] === 'number' ? parsed['daysLeft'] : null,
      checkedAt: typeof parsed['checkedAt'] === 'string' ? parsed['checkedAt'] : null,
    };
  }

  /** The last `maintenance.backup-check` reading (section 20.3). */
  private async backupStatus(): Promise<Record<string, unknown>> {
    const raw = await this.infra.redis.get(BACKUP_STATUS_KEY).catch(() => null);
    if (!raw) return { ok: false, state: 'unknown', lastRunAt: null, file: null, sizeBytes: 0 };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ok: parsed['ok'] === true,
      state: typeof parsed['state'] === 'string' ? parsed['state'] : 'unknown',
      lastRunAt: typeof parsed['at'] === 'string' ? parsed['at'] : null,
      file: typeof parsed['file'] === 'string' ? parsed['file'] : null,
      sizeBytes: typeof parsed['sizeBytes'] === 'number' ? parsed['sizeBytes'] : 0,
    };
  }

  /** The last `maintenance.disk-check` reading of the database volume (20.3). */
  private async diskStatus(): Promise<{
    totalBytes: number | null;
    freeBytes: number | null;
    freePct: number | null;
    alertPct: number | null;
    checkedAt: string | null;
  }> {
    const raw = await this.infra.redis.get(DISK_STATUS_KEY).catch(() => null);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const number = (key: string) => (typeof parsed[key] === 'number' ? parsed[key] : null);
    const mounted = parsed['available'] === true;
    return {
      totalBytes: mounted ? number('totalBytes') : null,
      freeBytes: mounted ? number('freeBytes') : null,
      freePct: number('freePct'),
      alertPct: number('alertPct'),
      checkedAt: typeof parsed['checkedAt'] === 'string' ? parsed['checkedAt'] : null,
    };
  }

  async overview() {
    const [panelSync, botMode, botUsername, outboxPending, tlsExpiresAt, dbSize] =
      await Promise.all([
        this.infra.db.panelUser.aggregate({ _max: { syncedAt: true } }),
        this.settings.get('bot.mode'),
        this.settings.get('bot.username'),
        this.infra.db.outboxJob.count({ where: { publishedAt: null } }),
        this.settings.get('domain.main'),
        this.infra.db.$queryRaw<
          { size: bigint }[]
        >`SELECT pg_database_size(current_database())::bigint AS size`,
      ]);

    return {
      app: {
        version: appVersion(),
        node: process.version,
        uptimeSeconds: Math.round(process.uptime()),
      },
      images: {
        app: process.env.RR_APP_IMAGE ?? null,
        web: process.env.RR_WEB_IMAGE ?? null,
        proxy: process.env.RR_PROXY_IMAGE ?? null,
      },
      panel: {
        lastSyncedAt: panelSync._max.syncedAt?.toISOString() ?? null,
        baseUrl: String(await this.settings.get('panel.base_url')),
      },
      bot: { mode: botMode, username: botUsername },
      outboxPending,
      database: { sizeBytes: Number(dbSize[0]?.size ?? 0n), volume: await this.diskStatus() },
      tls: { domain: String(tlsExpiresAt), ...(await this.tlsStatus()) },
      proxy: {
        profile: process.env.RR_PROXY_PROFILE ?? 'nginx',
        tlsMode: process.env.RR_TLS_MODE ?? 'acme',
        // Section 21.7: what the last request actually carried.
        trustedProxies: process.env.RR_TRUSTED_PROXIES ?? '',
        external: this.forwarded.last(),
        // Section 21.4: the official Caddy image has no rate-limit module, and
        // that degradation is surfaced here rather than left silent.
        rateLimited:
          (process.env.RR_PROXY_PROFILE ?? 'nginx') !== 'caddy' ||
          caddyHasRateLimit(process.env.RR_CADDY_IMAGE),
      },
      backups: await this.backupStatus(),
      healthUrl: '/api/v1/health',
    };
  }

  async queues() {
    const connection = new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    try {
      const items = [];
      for (const name of QUEUE_NAMES) {
        const queue = new Queue(name, { connection, prefix: 'rr:q' });
        try {
          const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
          items.push({
            name,
            waiting: counts['waiting'] ?? 0,
            active: counts['active'] ?? 0,
            failed: counts['failed'] ?? 0,
            delayed: counts['delayed'] ?? 0,
          });
        } finally {
          await queue.close();
        }
      }
      return { items };
    } catch {
      return {
        items: QUEUE_NAMES.map((name: string) => ({
          name,
          waiting: 0,
          active: 0,
          failed: 0,
          delayed: 0,
        })),
      };
    } finally {
      connection.disconnect();
    }
  }

  async retryFailed(name: string) {
    if (!QUEUE_NAMES.includes(name as (typeof QUEUE_NAMES)[number]))
      return new Audited(null, { retried: 0 }, { retried: 0 });
    const connection = new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    const queue = new Queue(name, { connection, prefix: 'rr:q' });
    try {
      const failed = await queue.getFailed(0, 500);
      for (const job of failed) await job.retry();
      return new Audited(
        { failed: failed.length },
        { retried: failed.length },
        {
          retried: failed.length,
        },
      );
    } finally {
      await queue.close();
      connection.disconnect();
    }
  }

  /** «Сверить с панелью» from the system page. */
  async reconcile() {
    const result = await this.panel.reconcile();
    return new Audited(null, result, result);
  }
}
