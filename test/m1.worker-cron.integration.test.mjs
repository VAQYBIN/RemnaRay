import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { GenericContainer } from 'testcontainers';

/**
 * Section 7.3 on a real Valkey: the worker queues `maintenance.subscriptions-
 * expire` (FR-024) and `panel.reconcile-all` (10.5) itself, its own consumers
 * call the internal API for them, and a restarted worker does not reconcile
 * again inside the same quarter hour.
 */
test(
  'M1 worker schedules subscription expiry and panel reconciliation',
  { timeout: 180_000 },
  async () => {
    const valkey = await new GenericContainer('valkey/valkey:9.1-alpine')
      .withExposedPorts(6379)
      .start();
    const calls = [];
    const api = createServer((request, response) => {
      calls.push({ path: request.url, token: request.headers['x-internal-token'] });
      response.setHeader('content-type', 'application/json');
      response.end('{}');
    });
    await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
    const previous = { ...process.env };
    process.env.VALKEY_URL = `redis://${valkey.getHost()}:${String(valkey.getMappedPort(6379))}/0`;
    process.env.RR_API_URL = `http://127.0.0.1:${String(api.address().port)}`;
    process.env.RR_INTERNAL_TOKEN = 'internal-token';
    process.env.RR_BACKUP_DIR = mkdtempSync(join(tmpdir(), 'rr-backups-'));
    delete process.env.RR_DOMAIN;
    const { WorkerService } = await import('../apps/worker/dist/queues/worker.service.js');
    const slot = () => Math.floor(Date.now() / (15 * 60_000));
    const count = (path) => calls.filter((call) => call.path === path).length;
    const until = async (predicate) => {
      for (let waited = 0; waited < 20_000 && !predicate(); waited += 100) await delay(100);
    };
    try {
      const started = slot();
      const first = new WorkerService();
      await first.onModuleInit();
      await until(
        () =>
          count('/api/internal/v1/subscriptions/expire') > 0 &&
          count('/api/internal/v1/remnawave/reconcile') > 0,
      );
      await first.onModuleDestroy();
      assert.equal(count('/api/internal/v1/subscriptions/expire'), 1);
      assert.equal(count('/api/internal/v1/remnawave/reconcile'), 1);
      assert.ok(calls.every((call) => call.token === 'internal-token'));

      const second = new WorkerService();
      await second.onModuleInit();
      await delay(3_000);
      await second.onModuleDestroy();
      // A quarter-hour boundary crossed mid-test legitimately starts a new slot.
      if (slot() === started) assert.equal(count('/api/internal/v1/remnawave/reconcile'), 1);
    } finally {
      process.env = previous;
      await new Promise((resolve) => api.close(resolve));
      await valkey.stop();
    }
  },
);
