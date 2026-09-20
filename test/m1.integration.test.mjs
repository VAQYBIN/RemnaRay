import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';

test(
  'M1 ledger and subscriptions work against PostgreSQL 18 and Valkey 9.1',
  { timeout: 240_000 },
  async () => {
    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    const valkey = await new GenericContainer('valkey/valkey:9.1-alpine')
      .withExposedPorts(6379)
      .start();
    const databaseUrl = postgres.getConnectionUri();
    try {
      execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      });
      const { createPrismaClient } = await import('../packages/db/dist/index.js');
      const { LedgerRepository } =
        await import('../apps/api/dist/modules/ledger/ledger.repository.js');
      const { SubscriptionsRepository } =
        await import('../apps/api/dist/modules/subscriptions/subscriptions.repository.js');
      const prisma = createPrismaClient(databaseUrl);
      const ledger = new LedgerRepository(prisma);
      const subscriptions = new SubscriptionsRepository(prisma);
      const user = await prisma.user.create({
        data: { telegramId: 991_000_001n, language: 'ru', referralCode: 'TCM1USER' },
      });
      const subscriptionUser = await prisma.user.create({
        data: { telegramId: 991_000_002n, language: 'ru', referralCode: 'TCM1SUBS' },
      });
      const plan = await prisma.plan.create({
        data: {
          slug: 'tc-m1',
          name: { ru: 'M1', en: 'M1' },
          durationDays: 30,
          squads: [],
          priceMinor: 29900n,
        },
      });

      await ledger.post({
        userId: user.id,
        type: 'topup',
        amountMinor: 10000n,
        currency: 'RUB',
        debit: { kind: 'revenue' },
        credit: { kind: 'user', userId: user.id },
      });
      const deductions = await Promise.all(
        Array.from({ length: 10 }, () =>
          ledger
            .post({
              userId: user.id,
              type: 'purchase',
              amountMinor: 6000n,
              currency: 'RUB',
              debit: { kind: 'user', userId: user.id },
              credit: { kind: 'revenue' },
            })
            .then(
              () => true,
              () => false,
            ),
        ),
      );
      assert.equal(deductions.filter(Boolean).length, 1);
      assert.equal(await ledger.available(user.id), 4000n);

      const trial = await subscriptions.trial(subscriptionUser.id, {
        trialEnabled: true,
        trialDays: 3,
        trialTrafficGb: 10,
        trialDeviceLimit: 1,
        trialSquads: [],
        graceHours: 0,
      });
      assert.equal(trial.source, 'trial');
      const activated = await subscriptions.activate(subscriptionUser.id, plan.id, 'purchase');
      const renewed = await subscriptions.activate(subscriptionUser.id, plan.id, 'purchase');
      assert.equal(renewed.status, 'active');
      assert.ok(Date.parse(renewed.expiresAt) > Date.parse(activated.expiresAt));
      assert.equal(await subscriptions.expire(new Date(Date.now() + 366 * 86_400_000), 0), 1);

      // Section 7.3: the outbox has to reach a worker. Two defects made that
      // impossible and neither side complained — BullMQ refuses a custom job
      // id containing its own separator, which every identifier here carries,
      // and the relay published under `rr:q` while the workers waited on
      // `bull`. Both are checked by running one job through for real.
      const { OutboxRelay, OutboxWriter, QUEUE_PREFIX, createRedisConnection } =
        await import('../packages/queues/dist/index.js');
      // Resolved through the worker, which owns the dependency (section 6.1).
      const { Worker } = await import('../apps/worker/node_modules/bullmq/dist/cjs/index.js');
      const valkeyUrl = `redis://${valkey.getHost()}:${String(valkey.getMappedPort(6379))}/0`;
      const redis = createRedisConnection(valkeyUrl);
      const relay = new OutboxRelay(prisma, redis);
      await prisma.$transaction(async (transaction) => {
        await new OutboxWriter().enqueue(transaction, {
          queue: 'notify',
          name: 'notify.send',
          payload: { userId: user.id },
          jobId: `notify:sub.activated:${user.id}`,
        });
      });
      const relayed = await relay.runOnce();
      assert.equal(relayed.published, 1, 'the relay published nothing');
      assert.equal(relayed.remaining, 0);

      const consumed = new Promise((resolve) => {
        const worker = new Worker('notify', (job) => Promise.resolve(job.id), {
          connection: { host: valkey.getHost(), port: valkey.getMappedPort(6379) },
          prefix: QUEUE_PREFIX,
        });
        worker.on('completed', (job) => {
          void worker.close().then(() => {
            resolve(job.id);
          });
        });
      });
      assert.equal(
        await consumed,
        `notify-sub.activated-${user.id}`,
        'the worker never received the relayed job',
      );
      redis.disconnect();
      await relay.close();

      await prisma.$disconnect();
    } finally {
      await valkey.stop();
      await postgres.stop();
    }
  },
);
