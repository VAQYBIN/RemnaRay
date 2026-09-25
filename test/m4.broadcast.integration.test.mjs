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
    /** Runs before a delivery is answered, to change state mid-chunk. */
    let beforeAnswer = null;
    /** Chats answering 429 `left` more times (-1: always). */
    const floods = new Map();

    globalThis.fetch = (input, init) => {
      const body = JSON.parse(init?.body ?? '{}');
      if (body.chat_id === blockedChatId)
        return Promise.resolve(new globalThis.Response('{"ok":false}', { status: 403 }));
      // Bot API flood control: 429 with `parameters.retry_after` seconds.
      const flood = floods.get(body.chat_id);
      if (flood && flood.left !== 0) {
        flood.left -= 1;
        flood.calls += 1;
        return Promise.resolve(
          new globalThis.Response(
            JSON.stringify({
              ok: false,
              error_code: 429,
              description: 'Too Many Requests: retry after 1',
              parameters: { retry_after: flood.retryAfter },
            }),
            { status: 429 },
          ),
        );
      }
      sent.push(body);
      const ok = () => new globalThis.Response('{"ok":true}', { status: 200 });
      return beforeAnswer ? beforeAnswer(sent.length).then(ok) : Promise.resolve(ok());
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

      // A paused broadcast is resumed, not started again.
      await assert.rejects(broadcasts.start(id), { status: 409 });

      // Resume: only the untouched recipients are queued again.
      await broadcasts.resume(id);
      const resumeJobs = await prisma.outboxJob.findMany({
        where: { queue: 'broadcast' },
        orderBy: { createdAt: 'asc' },
      });
      const resumed = resumeJobs.at(-1).payload.userIds;
      assert.equal(resumed.length, 2, 'only the pending deliveries are re-queued');
      // BullMQ ignores an id it still keeps: the first run's chunk, kept after
      // it completed, used to swallow the resume.
      assert.notEqual(resumeJobs.at(-1).jobId, jobs[0].jobId);

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

      // A finished broadcast cannot be paused, resumed or canceled.
      await assert.rejects(broadcasts.setStatus(id, 'paused'), { status: 409 });
      await assert.rejects(broadcasts.resume(id), { status: 409 });
      await assert.rejects(broadcasts.setStatus(id, 'canceled'), { status: 409 });

      // --- paused mid-chunk: what was sent is counted, a cancel is final ---
      for (let index = 0; index < 52; index += 1)
        await prisma.user.create({
          data: {
            telegramId: BigInt(997100000 + index),
            firstName: `En${String(index)}`,
            language: 'en',
            referralCode: `BCEN${String(index).padStart(4, '0')}`,
          },
        });
      const large = (
        await broadcasts.create(
          {
            title: 'Large',
            content: { text: { en: 'Hello' }, buttons: [], photo: null },
            segment: { all: [{ field: 'user.language', op: 'eq', value: 'en' }] },
          },
          admin.id,
        )
      ).after.id;
      await broadcasts.start(large);
      const [chunk] = await prisma.outboxJob.findMany({
        where: { queue: 'broadcast', payload: { path: ['broadcastId'], equals: large } },
      });
      const before = sent.length;
      beforeAnswer = async (count) => {
        if (count === before + 10)
          await prisma.broadcast.update({ where: { id: large }, data: { status: 'paused' } });
      };
      const stopped = await broadcasts.sendChunk({
        broadcastId: large,
        userIds: chunk.payload.userIds,
      });
      beforeAnswer = null;
      // The status is read every 50 messages.
      assert.equal(stopped.stopped, true);
      assert.equal(stopped.sent, 50);
      const counted = await prisma.broadcast.findUniqueOrThrow({ where: { id: large } });
      assert.equal(counted.sentCount, 50, 'the messages sent before the pause are counted');
      await broadcasts.setStatus(large, 'canceled');
      await assert.rejects(broadcasts.resume(large), { status: 409 });
      await assert.rejects(broadcasts.start(large), { status: 409 });

      // --- a 429 waits `retry_after` and sends again (section 16.x) ---
      const flooded = await prisma.user.create({
        data: { telegramId: 997200001n, language: 'de', referralCode: 'BCFLOOD1' },
      });
      const stuck = await prisma.user.create({
        data: { telegramId: 997200002n, language: 'de', referralCode: 'BCFLOOD2' },
      });
      floods.set('997200001', { left: 1, calls: 0, retryAfter: 1 });
      floods.set('997200002', { left: -1, calls: 0, retryAfter: 0 });
      const flood = (
        await broadcasts.create(
          {
            title: 'Flood',
            content: { text: { ru: 'Снова' }, buttons: [], photo: null },
            segment: { all: [{ field: 'user.language', op: 'eq', value: 'de' }] },
          },
          admin.id,
        )
      ).after.id;
      await broadcasts.start(flood);
      const startedAt = Date.now();
      const result = await broadcasts.sendChunk({
        broadcastId: flood,
        userIds: [flooded.id, stuck.id],
      });
      assert.deepEqual(result, { sent: 1, blocked: 0, failed: 1, stopped: false });
      assert.ok(Date.now() - startedAt >= 1_000, 'waited retry_after before sending again');
      assert.equal(sent.filter((message) => message.chat_id === '997200001').length, 1);
      // Five waits, then the recipient that is still flooded fails.
      assert.equal(floods.get('997200002').calls, 6);
      const floodReport = await broadcasts.report(flood);
      assert.equal(floodReport.counts.sent, 1);
      assert.equal(floodReport.counts.failed, 1);

      await prisma.$disconnect();
    } finally {
      globalThis.fetch = previousFetch;
      await postgres.stop();
    }
  },
);
