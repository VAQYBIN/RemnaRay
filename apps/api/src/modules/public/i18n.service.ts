import { createHash } from 'node:crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

import {
  localeDirectory,
  namespaces,
  readNamespace,
  SUPPORTED_LOCALES,
  type Locale,
  type MessageCatalog,
} from '@remnaray/i18n-core';

import { Infrastructure } from '../../infra/infra.module';

export const I18N_CHANGED_CHANNEL = 'rr:i18n.changed';
const BASE_LOCALE: Locale = 'en';

export type Catalog = { lang: string; namespace: string; messages: MessageCatalog; etag: string };

function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function etagOf(messages: MessageCatalog): string {
  return `"${createHash('sha256').update(JSON.stringify(messages)).digest('hex').slice(0, 16)}"`;
}

/**
 * Section 18.5 resolution order: `locale_overrides` → the `<lang>` file → the
 * `en` file → the key itself with a warning. Merged namespaces are cached in
 * Valkey under `rr:i18n:<lang>:<ns>` and dropped on `rr:i18n.changed`.
 */
@Injectable()
export class I18nService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(I18nService.name);
  private readonly memory = new Map<string, Catalog>();
  private subscriber: Redis | undefined;

  constructor(private readonly infra: Infrastructure) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    try {
      await this.subscriber.subscribe(I18N_CHANGED_CHANNEL);
      this.subscriber.on('message', (channel) => {
        if (channel === I18N_CHANGED_CHANNEL) this.memory.clear();
      });
    } catch (error) {
      this.logger.warn(`Locale change subscription unavailable: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  /** One namespace, with overrides applied and English used as the base. */
  async namespace(lang: string, namespace: string): Promise<Catalog> {
    if (!isLocale(lang)) throw new NotFoundException('NOT_FOUND');
    if (!namespaces.includes(namespace as (typeof namespaces)[number]))
      throw new NotFoundException('NOT_FOUND');

    const cacheKey = `${lang}:${namespace}`;
    const cached = this.memory.get(cacheKey);
    if (cached) return cached;

    const redisKey = `rr:i18n:${cacheKey}`;
    const stored = await this.infra.redis.get(redisKey).catch(() => null);
    if (stored) {
      const messages = JSON.parse(stored) as MessageCatalog;
      const catalog: Catalog = { lang, namespace, messages, etag: etagOf(messages) };
      this.memory.set(cacheKey, catalog);
      return catalog;
    }

    const root = localeDirectory();
    const messages: MessageCatalog = {
      ...readNamespace(root, BASE_LOCALE, namespace),
      ...readNamespace(root, lang, namespace),
      ...(await this.overrides(lang, namespace)),
    };
    const catalog: Catalog = { lang, namespace, messages, etag: etagOf(messages) };
    this.memory.set(cacheKey, catalog);
    await this.infra.redis.set(redisKey, JSON.stringify(messages), 'EX', 300).catch(() => null);
    return catalog;
  }

  /** Every namespace for a language, used by the bot and the admin surfaces. */
  async messages(lang: string): Promise<MessageCatalog> {
    const merged: MessageCatalog = {};
    for (const namespace of namespaces)
      Object.assign(merged, (await this.namespace(lang, namespace)).messages);
    return merged;
  }

  /** Shipped default, active override and resolved value for the admin editor. */
  async entries(lang: string, namespace: string) {
    if (!isLocale(lang)) throw new NotFoundException('NOT_FOUND');
    const root = localeDirectory();
    const shipped = {
      ...readNamespace(root, BASE_LOCALE, namespace),
      ...readNamespace(root, lang, namespace),
    };
    const overrides = await this.overrides(lang, namespace);
    const keys = [...new Set([...Object.keys(shipped), ...Object.keys(overrides)])].sort();
    return keys.map((key) => ({
      key,
      default: shipped[key] ?? null,
      override: overrides[key] ?? null,
    }));
  }

  /** Drops the cached catalogs in every process. */
  async invalidate(): Promise<void> {
    this.memory.clear();
    const keys = SUPPORTED_LOCALES.flatMap((lang) =>
      namespaces.map((namespace) => `rr:i18n:${lang}:${namespace}`),
    );
    await this.infra.redis.del(...keys).catch(() => 0);
    await this.infra.redis.publish(I18N_CHANGED_CHANNEL, JSON.stringify({ at: Date.now() }));
  }

  private async overrides(lang: string, namespace: string): Promise<MessageCatalog> {
    try {
      const rows = await this.infra.db.localeOverride.findMany({
        where: { lang, namespace },
        select: { key: true, value: true },
      });
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    } catch (error) {
      this.logger.warn(`Locale overrides unavailable: ${String(error)}`);
      return {};
    }
  }
}
