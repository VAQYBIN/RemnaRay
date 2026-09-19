import { describe, expect, it, vi } from 'vitest';

import { I18nService } from './i18n.service';

function service(overrides: { key: string; value: string }[] = []) {
  const redis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    publish: vi.fn().mockResolvedValue(1),
  };
  const db = { localeOverride: { findMany: vi.fn().mockResolvedValue(overrides) } };
  return { redis, db, instance: new I18nService({ redis, db } as never) };
}

describe('I18nService', () => {
  it('serves a shipped namespace with a stable ETag', async () => {
    const catalog = await service().instance.namespace('ru', 'landing');

    expect(catalog.lang).toBe('ru');
    expect(catalog.messages['landing.plansTitle']).toBe('Выберите тариф');
    expect(catalog.etag).toMatch(/^"[0-9a-f]{16}"$/);
  });

  it('applies locale overrides on top of the shipped file', async () => {
    const test = service([{ key: 'landing.plansTitle', value: 'Наши тарифы' }]);
    const catalog = await test.instance.namespace('ru', 'landing');

    expect(catalog.messages['landing.plansTitle']).toBe('Наши тарифы');
    expect(test.db.localeOverride.findMany).toHaveBeenCalledWith({
      where: { lang: 'ru', namespace: 'landing' },
      select: { key: true, value: true },
    });
  });

  it('falls back to the English file for a key the language does not ship', async () => {
    const instance = service().instance;
    const ru = await instance.namespace('ru', 'bot');
    const en = await instance.namespace('en', 'bot');

    for (const key of Object.keys(en.messages)) expect(ru.messages).toHaveProperty(key);
  });

  it('merges every namespace for the bot catalog', async () => {
    const messages = await service().instance.messages('en');

    expect(messages['bot.commands.start']).toBe('Start the bot');
    expect(messages['notify.sub.expired']).toBeTypeOf('string');
  });

  it('reports the shipped default next to the active override', async () => {
    const test = service([{ key: 'landing.plansTitle', value: 'Наши тарифы' }]);
    const entries = await test.instance.entries('ru', 'landing');
    const entry = entries.find((item) => item.key === 'landing.plansTitle');

    expect(entry).toEqual({
      key: 'landing.plansTitle',
      default: 'Выберите тариф',
      override: 'Наши тарифы',
    });
  });

  it('rejects unknown languages and namespaces', async () => {
    await expect(service().instance.namespace('de', 'landing')).rejects.toThrow();
    await expect(service().instance.namespace('ru', 'secrets')).rejects.toThrow();
  });

  it('drops every cached namespace and announces the change', async () => {
    const test = service();
    await test.instance.invalidate();

    expect(test.redis.del).toHaveBeenCalled();
    expect(test.redis.publish).toHaveBeenCalledWith('rr:i18n.changed', expect.any(String));
  });
});
