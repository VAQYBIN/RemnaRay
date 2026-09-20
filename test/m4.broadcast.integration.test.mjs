import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

test(
  'M4 broadcasts: AC-161 pause and resume never duplicate, blocked users are excluded',
  { timeout: 300_000 },
  async () => {
    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    const databaseUrl = postgres.getConnectionUri();
    const previousFetch = globalThis.fetch;
    const sent = [];
    let blockedChatId = null;

    globalThis.fetch = (input, init) => {
      const body = JSON.parse(init?.body ?? '{}');
      if (body.chat_id === blockedChatId)
        return Promise.resolve(new globalThis.Response('{"ok":false}', { status: 403 }));
      sent.push(body);
      return Promise.resolve(new globalThis.Response('{"ok":true}', { status: 200 }));
    };

    try {
      execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      });
      const { createPrismaClient } = await import('../packages/db/dist/index.js');
      const { BroadcastsService } =
        await import('../apps/api/dist/modules/broadcasts/broadcasts.service.js');
      const prisma = createPrismaClient(databaseUrl);
      const settings = {
        get: (key) =>
          Promise.resolve(
            key === 'bot.token' ? 'test-token' : key === 'bot.username' ? 'manta_bot' : 'ru',
          ),
      };
      const broadcasts = new BroadcastsService({ db: prisma }, settings);

      const admin = await prisma.admin.create({
        data: {
          email: 'bc@example.test',
          passwordHash: 'x',
          role: 'admin',
          telegramId: 997000999n,
        },
      });

      const audience = [];
      for (let index = 0; index < 6; index += 1) {
        audience.push(
          await prisma.user.create({
            data: {
              telegramId: BigInt(997000000 + index),
              firstName: `User${String(index)}`,
              language: 'ru',
              referralCode: `BCUSER${String(index)}`,
            },
          }),
        );
      }
      // Excluded by section 16.3: blocked, opted out, banned.
      await prisma.user.update({
        where: { id: audience[4].id },
        data: { botBlockedAt: new Date() },
      });
      await prisma.user.update({ where: { id: audience[5].id }, data: { marketingOptOut: true } });
      // This one blocks the bot only at send time, so Telegram answers 403.
      blockedChatId = audience[3].telegramId.toString();

      const broadcast = await broadcasts.create(
        {
          title: 'Autumn',
          content: { text: { ru: 'Привет, <b>{first_name}</b>!' }, buttons: [], photo: null },
          segment: { all: [{ field: 'user.language', op: 'eq', value: 'ru' }] },
        },
        admin.id,
      );
      const id = broadcast.after.id;

      const preview = await broadcasts.previewSegment(id);
      assert.equal(preview.count, 4, 'blocked, opted-out and banned users are excluded up front');

      await broadcasts.start(id);
      const jobs = await prisma.outboxJob.findMany({ where: { queue: 'broadcast' } });
      assert.equal(jobs.length, 1);
      const userIds = jobs[0].payload.userIds;
      assert.equal(userIds.length, 4);
      assert.ok(!userIds.includes(audience[4].id));
      assert.ok(!userIds.includes(audience[5].id));

      // Deliver the first two, then pause mid-run.
      const firstHalf = await broadcasts.sendChunk({
        broadcastId: id,
        userIds: userIds.slice(0, 2),
      });
      assert.equal(firstHalf.sent, 2);
      await broadcasts.setStatus(id, 'paused');

      const paused = await broadcasts.sendChunk({ broadcastId: id, userIds });
      assert.equal(paused.stopped, true, 'a paused broadcast sends nothing');
      assert.equal(paused.sent, 0);

      // Resume: only the untouched recipients are queued again.
      await broadcasts.start(id);
      const resumeJobs = await prisma.outboxJob.findMany({
        where: { queue: 'broadcast' },
        orderBy: { createdAt: 'asc' },
      });
      const resumed = resumeJobs.at(-1).payload.userIds;
      assert.equal(resumed.length, 2, 'only the pending deliveries are re-queued');

      const second = await broadcasts.sendChunk({ broadcastId: id, userIds: resumed });
      assert.equal(second.sent + second.blocked, 2);
      assert.equal(second.blocked, 1, 'a 403 marks the recipient blocked');

      const report = await broadcasts.report(id);
      assert.equal(report.counts.pending, 0);
      assert.equal(report.counts.sent, 3);
      assert.equal(report.counts.blocked, 1);
      assert.equal(report.broadcast.status, 'done');

      // Nobody was messaged twice.
      const chatIds = sent.map((message) => message.chat_id);
      assert.equal(new Set(chatIds).size, chatIds.length, 'no duplicate delivery');
      assert.equal(chatIds.length, 3);
      assert.match(sent[0].text, /Привет, <b>User0<\/b>!/u);

      // The 403 recipient is marked blocked for later runs.
      const reblocked = await prisma.user.findUnique({ where: { id: audience[3].id } });
      assert.ok(reblocked.botBlockedAt);

      await prisma.$disconnect();
    } finally {
      globalThis.fetch = previousFetch;
      await postgres.stop();
    }
  },
);
