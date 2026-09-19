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
  ) {}

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
      database: { sizeBytes: Number(dbSize[0]?.size ?? 0n) },
      tls: { domain: String(tlsExpiresAt), expiresAt: process.env.RR_TLS_EXPIRES_AT ?? null },
      backups: { lastRunAt: process.env.RR_LAST_BACKUP_AT ?? null },
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
