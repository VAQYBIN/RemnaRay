import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../../infra/infra.module';
import type { NotifyService } from '../notify/notify.service';
import type { SettingsService } from '../settings/settings.service';
import { compareVersions, updateFor } from './app-version';
import { InternalProxyController, UPDATE_STATUS_KEY } from './proxy.controller';

const release = (version: string, security = false) => ({
  version,
  url: `https://example.test/v${version}`,
  security,
  publishedAt: null,
});

describe('section 24.6 update check', () => {
  afterEach(() => {
    delete process.env.RR_APP_VERSION;
  });

  it('compares versions as numbers', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('0.9.0', '1.0.0')).toBe(-1);
    expect(compareVersions('1.2.3-rc.1', '1.2.3')).toBeNull();
  });

  it('names the highest release, not the one published last', () => {
    // A security patch to the previous minor, published after 1.2.3.
    expect(updateFor('1.2.0', [release('1.1.6', true), release('1.2.3')])).toEqual({
      current: '1.2.0',
      latest: '1.2.3',
      url: 'https://example.test/v1.2.3',
      available: true,
      security: false,
    });
  });

  it('carries the security badge of any release skipped on the way', () => {
    expect(updateFor('1.2.0', [release('1.2.1', true), release('1.2.2')])).toMatchObject({
      latest: '1.2.2',
      available: true,
      security: true,
    });
    // One already running is not news.
    expect(updateFor('1.2.1', [release('1.2.1', true)])).toMatchObject({
      available: false,
      security: false,
    });
  });

  it('claims no update for a build without a release version', () => {
    expect(updateFor('0.0.0-dev', [release('1.0.0')])).toMatchObject({
      latest: '1.0.0',
      available: false,
    });
  });

  function controller(checkUpdates: unknown) {
    const stored = new Map<string, string>();
    const infra = {
      redis: {
        get: vi.fn((key: string) => Promise.resolve(stored.get(key) ?? null)),
        set: vi.fn((key: string, value: string) => {
          stored.set(key, value);
          return Promise.resolve('OK');
        }),
      },
    };
    const settings = { get: vi.fn(() => Promise.resolve(checkUpdates)) };
    return {
      stored,
      settings,
      controller: new InternalProxyController(
        infra as unknown as Infrastructure,
        {} as NotifyService,
        settings as unknown as SettingsService,
      ),
    };
  }

  it('tells the worker whether admin.check_updates allows asking GitHub', async () => {
    const on = controller(true);
    await expect(on.controller.updateCheck()).resolves.toEqual({ enabled: true });
    expect(on.settings.get).toHaveBeenCalledWith('admin.check_updates');
    await expect(controller(false).controller.updateCheck()).resolves.toEqual({ enabled: false });
  });

  it('keeps the answer against the running version, and an error beside it', async () => {
    process.env.RR_APP_VERSION = '1.2.0';
    const { controller: api, stored } = controller(true);
    await expect(api.updateResult({ releases: [release('1.2.3', true)] })).resolves.toMatchObject({
      recorded: true,
      latest: '1.2.3',
      available: true,
      security: true,
    });

    // GitHub down the next day: the update found stays visible.
    await api.updateResult({ releases: [], error: 'GitHub answered 503' });
    expect(JSON.parse(stored.get(UPDATE_STATUS_KEY) ?? '{}')).toMatchObject({
      latest: '1.2.3',
      available: true,
      error: 'GitHub answered 503',
    });
    await expect(api.updateResult({ releases: [{ version: 'v1' }] })).rejects.toThrow();
  });
});
