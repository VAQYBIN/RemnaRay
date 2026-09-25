import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../../infra/infra.module';
import type { SettingsService } from '../settings/settings.service';
import { PanelBusyError, panelTag, RemnawaveService } from './remnawave.service';

const USER_ID = '0199a0b0-0000-7000-8000-000000000001';

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server)
      server.close(() => {
        resolve();
      });
    else resolve();
  });
  server = undefined;
});

/** A panel answering `status` with a v3.4.4 user and recording each request. */
async function panel(status = 200, usedTrafficBytes = 0) {
  const requests: string[] = [];
  server = createServer((request, response) => {
    requests.push(`${request.method ?? ''} ${request.url ?? ''}`);
    request.resume();
    request.on('end', () => {
      response.statusCode = status;
      response.setHeader('content-type', 'application/json');
      if (status === 204) return response.end();
      if (status >= 400) return response.end(JSON.stringify({ message: 'not found' }));
      response.end(
        JSON.stringify({
          response: {
            id: 42,
            shortUuid: 'short42',
            username: 'rr_123',
            status: 'ACTIVE',
            trafficLimitBytes: 1024,
            trafficLimitStrategy: 'NO_RESET',
            expireAt: '2026-10-01T00:00:00.000Z',
            telegramId: 123,
            email: null,
            description: null,
            tag: null,
            hwidDeviceLimit: null,
            vlessUuid: '0199a0b0-0000-7000-8000-0000000000aa',
            subscriptionUrl: 'https://panel.test/sub/short42',
            activeInternalSquads: [],
            userTraffic: { usedTrafficBytes, lifetimeUsedTrafficBytes: 900 },
          },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${String(port)}`, requests };
}

/** The two Valkey calls the `rr:lock:panel:<userId>` lock makes. */
function lockStore() {
  const keys = new Map<string, string>();
  return {
    keys,
    set: (key: string, value: string) => {
      if (keys.has(key)) return Promise.resolve(null);
      keys.set(key, value);
      return Promise.resolve('OK');
    },
    eval: (_script: string, _count: number, key: string, token: string) => {
      if (keys.get(key) === token) keys.delete(key);
      return Promise.resolve(1);
    },
  };
}

function service(baseUrl: string, row: { panelUserId: number | null } | null, redis = lockStore()) {
  const panelUser = {
    findUnique: vi.fn().mockResolvedValue(row && { userId: USER_ID, ...row }),
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const values: Record<string, unknown> = {
    'panel.base_url': baseUrl,
    'panel.api_token': 'token',
    'panel.extra_headers': {},
  };
  return {
    panelUser,
    panel: new RemnawaveService(
      { db: { panelUser }, redis } as unknown as Infrastructure,
      { get: (key: string) => Promise.resolve(values[key]) } as unknown as SettingsService,
    ),
  };
}

describe('panel.reset-traffic (FR-141)', () => {
  it('resets the panel user by its numeric id and stores what the panel answers', async () => {
    const target = await panel();
    const { panel: remnawave, panelUser } = service(target.baseUrl, { panelUserId: 42 });

    await expect(remnawave.resetTraffic(USER_ID)).resolves.toEqual({ reset: true });

    expect(target.requests).toEqual(['POST /api/users/42/actions/reset-traffic']);
    expect(panelUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ usedTrafficBytes: 0n }) as unknown,
      }),
    );
  });

  it('resets on a downgrade when the panel reports more used than the new limit (FR-023)', async () => {
    const target = await panel(200, 5_000);
    const { panel: remnawave } = service(target.baseUrl, { panelUserId: 42 });

    await expect(remnawave.resetTraffic(USER_ID, 1_000n)).resolves.toEqual({ reset: true });
    expect(target.requests).toEqual([
      'GET /api/users/42',
      'POST /api/users/42/actions/reset-traffic',
    ]);
  });

  it('keeps the traffic when the new limit still covers what is used (FR-023)', async () => {
    const target = await panel(200, 1_000);
    const { panel: remnawave, panelUser } = service(target.baseUrl, { panelUserId: 42 });

    await expect(remnawave.resetTraffic(USER_ID, 1_000n)).resolves.toEqual({ reset: false });
    expect(target.requests).toEqual(['GET /api/users/42']);
    expect(panelUser.upsert).not.toHaveBeenCalled();
  });

  it('has nothing to reset for a user the panel does not know yet', async () => {
    const target = await panel();
    for (const row of [null, { panelUserId: null }]) {
      const { panel: remnawave } = service(target.baseUrl, row);
      await expect(remnawave.resetTraffic(USER_ID)).resolves.toEqual({ reset: false });
    }
    expect(target.requests).toEqual([]);
  });

  it('fails when the panel does, so the job is retried', async () => {
    const target = await panel(503);
    const { panel: remnawave } = service(target.baseUrl, { panelUserId: 42 });
    await expect(remnawave.resetTraffic(USER_ID)).rejects.toThrow();
  });
});

describe('panel.delete-user (section 19.5)', () => {
  it('deletes the panel user by its numeric id and forgets the mapping', async () => {
    const target = await panel(204);
    const { panel: remnawave, panelUser } = service(target.baseUrl, { panelUserId: 42 });

    await expect(remnawave.deleteUser(USER_ID)).resolves.toEqual({ deleted: true });

    expect(target.requests).toEqual(['DELETE /api/users/42']);
    expect(panelUser.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it('treats a user the panel no longer has as deleted', async () => {
    const target = await panel(404);
    const { panel: remnawave, panelUser } = service(target.baseUrl, { panelUserId: 42 });

    await expect(remnawave.deleteUser(USER_ID)).resolves.toEqual({ deleted: true });
    expect(panelUser.deleteMany).toHaveBeenCalled();
  });

  it('keeps the mapping when the panel fails, so the retry can delete it', async () => {
    const target = await panel(503);
    const { panel: remnawave, panelUser } = service(target.baseUrl, { panelUserId: 42 });

    await expect(remnawave.deleteUser(USER_ID)).rejects.toThrow();
    expect(panelUser.deleteMany).not.toHaveBeenCalled();
  });

  it('only forgets a mapping that never reached the panel', async () => {
    const target = await panel();
    const { panel: remnawave, panelUser } = service(target.baseUrl, { panelUserId: null });

    await expect(remnawave.deleteUser(USER_ID)).resolves.toEqual({ deleted: true });
    expect(target.requests).toEqual([]);
    expect(panelUser.deleteMany).toHaveBeenCalled();
  });
});

describe('the panel tag (section 10.3)', () => {
  it('is the plan slug in the form the panel accepts, or TRIAL', () => {
    expect(panelTag(null)).toBe('TRIAL');
    expect(panelTag('month')).toBe('MONTH');
    expect(panelTag('pro-3m')).toBe('PRO_3M');
    expect(panelTag('a-very-long-plan-slug-name')).toBe('A_VERY_LONG_PLAN');
  });

  it('always matches the panel pattern', () => {
    for (const slug of ['0', 'x_y-z', 'z'.repeat(64)])
      expect(panelTag(slug)).toMatch(/^[A-Z0-9_]{1,16}$/u);
  });
});

describe('the panel lock (section 10.3)', () => {
  it('refuses a second write for the user while one holds the lock, and releases it', async () => {
    const target = await panel();
    const redis = lockStore();
    redis.keys.set(`rr:lock:panel:${USER_ID}`, 'someone-else');
    const { panel: remnawave } = service(target.baseUrl, { panelUserId: 42 }, redis);

    await expect(remnawave.resetTraffic(USER_ID)).rejects.toBeInstanceOf(PanelBusyError);
    await expect(remnawave.deleteUser(USER_ID)).rejects.toBeInstanceOf(PanelBusyError);
    expect(target.requests).toEqual([]);
    // Not released by a caller that never held it.
    expect(redis.keys.get(`rr:lock:panel:${USER_ID}`)).toBe('someone-else');

    redis.keys.clear();
    await expect(remnawave.resetTraffic(USER_ID)).resolves.toEqual({ reset: true });
    expect(redis.keys.size).toBe(0);
  });

  it('releases the lock when the panel fails', async () => {
    const target = await panel(503);
    const redis = lockStore();
    const { panel: remnawave } = service(target.baseUrl, { panelUserId: 42 }, redis);
    await expect(remnawave.resetTraffic(USER_ID)).rejects.toThrow();
    expect(redis.keys.size).toBe(0);
  });
});
