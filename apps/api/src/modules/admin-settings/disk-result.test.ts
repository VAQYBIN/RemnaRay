import { describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../../infra/infra.module';
import type { NotifyService } from '../notify/notify.service';
import type { SettingsService } from '../settings/settings.service';
import { DISK_STATUS_KEY, InternalProxyController } from './proxy.controller';

const GIB = 1024 ** 3;

function setup(alertPct = 10) {
  const stored = new Map<string, string>();
  const infra = {
    redis: {
      set: vi.fn((key: string, value: string) => {
        stored.set(key, value);
        return Promise.resolve('OK');
      }),
    },
    db: { $queryRaw: vi.fn(() => Promise.resolve([{ size: 42n * 1024n * 1024n }])) },
  };
  const notify = { alert: vi.fn(() => Promise.resolve({ delivered: 1, deduplicated: false })) };
  const settings = { get: vi.fn(() => Promise.resolve(alertPct)) };
  const controller = new InternalProxyController(
    infra as unknown as Infrastructure,
    notify as unknown as NotifyService,
    settings as unknown as SettingsService,
  );
  const reading = () => JSON.parse(stored.get(DISK_STATUS_KEY) ?? '{}') as Record<string, unknown>;
  return { controller, notify, settings, reading };
}

describe('section 20.3 disk check', () => {
  it('raises disk.low below admin.disk_alert_pct of the database volume free (FR-163)', async () => {
    const { controller, notify, settings, reading } = setup();
    const result = await controller.diskResult({
      available: true,
      totalBytes: 100 * GIB,
      freeBytes: 8 * GIB,
    });

    expect(settings.get).toHaveBeenCalledWith('admin.disk_alert_pct');
    expect(result).toEqual({ recorded: true, alerted: true });
    expect(notify.alert).toHaveBeenCalledWith({
      type: 'disk.low',
      details: '8.0 GiB free of 100.0 GiB (8.0 %)',
    });
    expect(reading()).toMatchObject({
      freePct: 8,
      alertPct: 10,
      databaseBytes: 42 * 1024 * 1024,
    });
  });

  it('stays quiet at or above the threshold, and follows the setting', async () => {
    const quiet = setup();
    await expect(
      quiet.controller.diskResult({ available: true, totalBytes: 100 * GIB, freeBytes: 10 * GIB }),
    ).resolves.toEqual({ recorded: true, alerted: false });
    expect(quiet.notify.alert).not.toHaveBeenCalled();

    const stricter = setup(25);
    await expect(
      stricter.controller.diskResult({
        available: true,
        totalBytes: 100 * GIB,
        freeBytes: 20 * GIB,
      }),
    ).resolves.toEqual({ recorded: true, alerted: true });
  });

  it('records an unmounted volume without calling it full', async () => {
    const { controller, notify, reading } = setup();
    await expect(
      controller.diskResult({ available: false, totalBytes: 0, freeBytes: 0, error: 'ENOENT' }),
    ).resolves.toEqual({ recorded: true, alerted: false });
    expect(notify.alert).not.toHaveBeenCalled();
    expect(reading()).toMatchObject({ available: false, freePct: null, error: 'ENOENT' });
  });

  it('refuses a malformed reading', async () => {
    const { controller } = setup();
    await expect(controller.diskResult({ available: true, totalBytes: -1 })).rejects.toThrow();
  });
});
