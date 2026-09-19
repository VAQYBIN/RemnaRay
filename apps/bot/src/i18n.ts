import { formatMessage, SUPPORTED_LOCALES, type Locale } from '@remnaray/i18n-core';
import type { Middleware } from 'grammy';

import type { ApiClient } from './api-client.js';
import type { RrContext } from './types.js';

type CachedCatalog = { expiresAt: number; messages: Record<string, string> };

export class BotI18n {
  private readonly cache = new Map<Locale, CachedCatalog>();

  constructor(
    private readonly api: ApiClient,
    private readonly ttlMs = 60_000,
  ) {}

  async catalog(locale: Locale): Promise<Record<string, string>> {
    const cached = this.cache.get(locale);
    if (cached && cached.expiresAt > Date.now()) return cached.messages;
    const response = await this.api.getMessages(locale);
    this.cache.set(locale, { expiresAt: Date.now() + this.ttlMs, messages: response.messages });
    return response.messages;
  }

  middleware(): Middleware<RrContext> {
    return async (ctx, next) => {
      const locale = ctx.session.lang;
      const messages = await this.catalog(locale);
      ctx.locale = locale;
      ctx.t = (key, values = {}) => formatMessage(locale, messages, key, values);
      await next();
    };
  }
}

export function normalizeLocale(value: string | undefined): Locale | undefined {
  const normalized = value?.slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.includes(normalized as Locale) ? (normalized as Locale) : undefined;
}
