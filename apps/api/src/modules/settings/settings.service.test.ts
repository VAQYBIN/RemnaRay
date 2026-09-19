import { describe, expect, it } from 'vitest';

import { SettingsService } from './settings.service';
import type { SettingsChangedEvent, SettingsEventBusPort } from './settings.events';
import type { SettingsRepositoryPort, SettingWrite, StoredSetting } from './settings.repository';

const appKey = Buffer.alloc(32, 9).toString('base64');

class MemoryRepository implements SettingsRepositoryPort {
  values: StoredSetting[] = [];
  replaceCalls: SettingWrite[][] = [];

  list() {
    return Promise.resolve(this.values);
  }

  replace(values: SettingWrite[]) {
    this.replaceCalls.push(values);
    for (const value of values) {
      const existing = this.values.find((item) => item.key === value.key);
      if (existing) Object.assign(existing, value);
      else this.values.push({ ...value });
    }
    return Promise.resolve();
  }
}

class MemoryEventBus implements SettingsEventBusPort {
  events: SettingsChangedEvent[] = [];
  private handler: ((event: SettingsChangedEvent) => void) | undefined;

  publish(event: SettingsChangedEvent) {
    this.events.push(event);
    return Promise.resolve();
  }

  subscribe(handler: (event: SettingsChangedEvent) => void) {
    this.handler = handler;
    return Promise.resolve();
  }

  async close() {}

  emit(event: SettingsChangedEvent) {
    this.handler?.(event);
  }
}

describe('SettingsService', () => {
  it('exposes registry defaults and masks secrets', async () => {
    const repository = new MemoryRepository();
    const events = new MemoryEventBus();
    const service = new SettingsService(repository, events, appKey);
    await service.onModuleInit();

    const settings = await service.getAll(false);
    expect(settings.setup?.completed).toBe(false);
    expect(settings.panel?.api_token).toEqual({ set: false });
    expect(settings.locale?.enabled).toEqual(['ru', 'en']);
    expect(service.schema().some((item) => item.key === 'webhooks.outgoing')).toBe(true);
  });

  it('validates a whole group, encrypts secrets, and publishes invalidation', async () => {
    const repository = new MemoryRepository();
    const events = new MemoryEventBus();
    const service = new SettingsService(repository, events, appKey);
    await service.onModuleInit();

    await service.set({
      domain: { main: 'shop.example.com', extra_domains: ['www.example.com'] },
      panel: { api_token: 'panel-secret' },
    });

    const stored = repository.values.find((item) => item.key === 'panel.api_token');
    expect(stored?.isSecret).toBe(true);
    expect(JSON.stringify(stored?.value)).not.toContain('panel-secret');
    expect(await service.get('panel.api_token')).toBe('panel-secret');
    expect((await service.exportSnapshot()).settings.panel?.api_token).toEqual({ set: true });
    expect(events.events.at(-1)?.keys).toEqual([
      'domain.main',
      'domain.extra_domains',
      'panel.api_token',
    ]);

    await expect(service.set({ locale: { default: 'de' } })).rejects.toThrow();
    expect(repository.replaceCalls).toHaveLength(1);
  });

  it('preserves a secret when an exported marker is imported', async () => {
    const repository = new MemoryRepository();
    const events = new MemoryEventBus();
    const service = new SettingsService(repository, events, appKey);
    await service.onModuleInit();
    await service.set({ bot: { token: 'bot-secret' } });

    await service.importSnapshot({
      version: 1,
      settings: { bot: { token: { set: true } } },
    });

    expect(await service.get('bot.token')).toBe('bot-secret');
    expect(repository.replaceCalls).toHaveLength(1);
  });

  it('invalidates only the keys announced by another process', async () => {
    const repository = new MemoryRepository();
    const events = new MemoryEventBus();
    const service = new SettingsService(repository, events, appKey);
    await service.onModuleInit();
    expect(await service.get('brand.name')).toBe('RemnaRay Shop');

    repository.values.push({ key: 'brand.name', value: 'Updated', isSecret: false });
    events.emit({ keys: ['brand.name'], version: Date.now() });

    expect(await service.get('brand.name')).toBe('Updated');
  });
});

describe('section 17.6 reaction matrix', () => {
  it('asks the right process to reconfigure for each key prefix', () => {
    expect(SettingsService.sideEffects(['bot.token']).channels).toEqual(['rr:bot.reconfigure']);
    expect(SettingsService.sideEffects(['domain.main']).channels).toEqual(['rr:proxy.reload']);
    expect(SettingsService.sideEffects(['theme.slug']).channels).toEqual(['rr:theme.changed']);
    expect(SettingsService.sideEffects(['locale.enabled']).channels).toEqual(['rr:i18n.changed']);
    expect(SettingsService.sideEffects(['brand.name']).channels).toEqual([]);
  });

  it('deduplicates channels and reports no restart for v1 keys', () => {
    const result = SettingsService.sideEffects([
      'bot.token',
      'bot.mode',
      'theme.slug',
      'invoice.ttl_minutes',
    ]);

    expect(result.channels).toEqual(['rr:bot.reconfigure', 'rr:theme.changed']);
    expect(result.restartRequired).toEqual([]);
  });
});
