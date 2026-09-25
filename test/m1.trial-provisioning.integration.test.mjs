import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';

/**
 * FR-010 and EX-01 on a real PostgreSQL and the panel mock: a trial waits in
 * `provisioning` with a `panel.sync-user` queued, the sync creates the panel
 * user and activates it with `subscription.activated` and the customer's
 * message, a panel that is down leaves it waiting to be synced again by the
 * reconciliation, and after 24 h it is `provisioning_failed` with an alert.
 */
test('M1 a trial reaches the panel before it is active', { timeout: 240_000 }, async () => {
  const [postgres, valkey] = await Promise.all([
    new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start(),
    // The `rr:lock:panel:<userId>` lock of section 10.3.
    new GenericContainer('valkey/valkey:9.1-alpine').withExposedPorts(6379).start(),
  ]);
  let prisma;
  let panel;
  let redis;
  try {
    execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: postgres.getConnectionUri() },
      stdio: 'pipe',
    });
    const { createPrismaClient } = await import('../packages/db/dist/index.js');
    const { SubscriptionsRepository } =
      await import('../apps/api/dist/modules/subscriptions/subscriptions.repository.js');
    const { RemnawaveService } =
      await import('../apps/api/dist/modules/remnawave/remnawave.service.js');
    const { createRemnawaveMock } = await import('../packages/remnawave-mock/dist/index.js');
    const { createRedisConnection } = await import('../packages/queues/dist/index.js');
    redis = createRedisConnection(
      `redis://${valkey.getHost()}:${String(valkey.getMappedPort(6379))}/0`,
    );
    prisma = createPrismaClient(postgres.getConnectionUri());
    panel = createRemnawaveMock();
    const baseUrl = await panel.listen({ port: 0, host: '127.0.0.1' });
    const values = {
      'panel.base_url': baseUrl,
      'panel.api_token': 'token',
      'panel.extra_headers': {},
      'brand.name': 'Manta',
    };
    const remnawave = new RemnawaveService(
      { db: prisma, redis },
      { get: (key) => Promise.resolve(values[key]) },
    );
    const subscriptions = new SubscriptionsRepository(prisma);
    const config = {
      trialEnabled: true,
      trialDays: 3,
      trialTrafficGb: 10,
      trialDeviceLimit: 2,
      trialSquads: [],
      graceHours: 0,
    };
    const newUser = (n) =>
      prisma.user.create({
        data: {
          telegramId: 995000000n + BigInt(n),
          language: 'ru',
          referralCode: `M1PROV0${String(n)}`,
        },
      });
    const outbox = (name) =>
      prisma.outboxJob.findMany({
        where: { name },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

    // --- the trial waits for the panel ---
    const user = await newUser(1);
    const trial = await subscriptions.trial(user.id, config);
    assert.equal(trial.status, 'provisioning');
    assert.deepEqual(
      (await outbox('panel.sync-user')).map((row) => [row.payload, row.jobId]),
      [[{ userId: user.id, reason: 'trial' }, `sync:${user.id}`]],
    );
    assert.deepEqual(await outbox('webhooks.dispatch'), [], 'not activated yet');

    // --- the sync provisions and activates it; a concurrent one waits its turn ---
    // Two `panel` jobs run at once (7.3); `rr:lock:panel:<userId>` (10.3)
    // keeps them from creating the panel user twice.
    const both = await Promise.allSettled([
      remnawave.syncUser(user.id, 'trial'),
      remnawave.syncUser(user.id, 'trial'),
    ]);
    assert.deepEqual(both.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(both.find((result) => result.status === 'rejected').reason.code, 'PANEL_BUSY');
    assert.equal(await redis.exists(`rr:lock:panel:${user.id}`), 0, 'the lock is released');
    const active = await prisma.subscription.findUniqueOrThrow({ where: { id: trial.id } });
    assert.equal(active.status, 'active');
    assert.equal(panel.users.size, 1);
    const [panelUser] = [...panel.users.values()];
    assert.equal(panelUser.telegramId, 995000001);
    assert.equal(panelUser.expireAt, trial.expiresAt);
    const [activated] = await outbox('webhooks.dispatch');
    assert.equal(activated.payload.type, 'subscription.activated');
    assert.equal(activated.payload.data.subscriptionId, trial.id);
    assert.equal(activated.payload.data.status, 'active');
    const [message] = await outbox('notify.send');
    assert.equal(message.payload.event, 'sub.activated');
    assert.equal(message.payload.userId, user.id);
    // A second sync changes nothing and activates nothing again.
    await remnawave.syncUser(user.id, 'queue');
    assert.equal((await outbox('webhooks.dispatch')).length, 1);
    assert.equal((await outbox('notify.send')).length, 1);

    // --- a panel that is down leaves it provisioning, and reconciliation retries ---
    const waiting = await newUser(2);
    const second = await subscriptions.trial(waiting.id, config);
    panel.mode = 'down';
    await assert.rejects(remnawave.syncUser(waiting.id, 'trial'));
    assert.equal(
      (await prisma.subscription.findUniqueOrThrow({ where: { id: second.id } })).status,
      'provisioning',
    );
    const syncsBefore = (await outbox('panel.sync-user')).length;
    assert.deepEqual(await remnawave.retryProvisioning(), { retried: 1, failed: 0 });
    const syncs = await outbox('panel.sync-user');
    assert.equal(syncs.length, syncsBefore + 1);
    assert.deepEqual(syncs.at(-1).payload, { userId: waiting.id, reason: 'provisioning' });

    // --- after 24 h it has failed, and the administrators hear of it ---
    assert.deepEqual(await remnawave.retryProvisioning(new Date(Date.now() + 24 * 3_600_000 + 1)), {
      retried: 0,
      failed: 1,
    });
    assert.equal(
      (await prisma.subscription.findUniqueOrThrow({ where: { id: second.id } })).status,
      'provisioning_failed',
    );
    const [alert] = await outbox('notify.alert');
    assert.deepEqual(alert.payload, { type: 'provisioning.failed', details: waiting.id });
    assert.equal(alert.jobId, `alert:provisioning.failed:${second.id}`);
    assert.deepEqual(await remnawave.retryProvisioning(), { retried: 0, failed: 0 });
  } finally {
    await panel?.close();
    redis?.disconnect();
    await prisma?.$disconnect();
    await Promise.all([postgres.stop(), valkey.stop()]);
  }
});
