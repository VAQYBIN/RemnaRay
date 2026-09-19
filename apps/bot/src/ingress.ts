import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Bot } from 'grammy';
import { run, type RunnerHandle } from '@grammyjs/runner';
import type { Update } from 'grammy/types';
import type Redis from 'ioredis';

import { ALLOWED_UPDATES, type BotConfig, type RrContext } from './types.js';

export const TELEGRAM_UPDATES_STREAM = 'tg:updates';
const GROUP = 'bot';

// Both transports persist before acknowledging delivery. Telegram may redeliver
// an update during a mode transition, so append and dedup must be atomic.
const APPEND = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('XADD', KEYS[1], 'MAXLEN', '~', 10000, '*', 'payload', ARGV[1])
redis.call('SET', KEYS[2], '1', 'EX', 604800)
return 1`;

export class BotIngress {
  private runner: RunnerHandle | undefined;
  private streamLoop: Promise<void> | undefined;
  private stopping = false;
  private readonly reader: Redis;
  private claimCursor = '0-0';
  private transition = Promise.resolve();

  constructor(
    private readonly bot: Bot<RrContext>,
    private readonly redis: Redis,
    private readonly consumer = `bot-${randomUUID()}`,
  ) {
    this.reader = redis.duplicate();
  }

  start(config: Pick<BotConfig, 'mode' | 'webhookUrl' | 'secretToken'>): Promise<void> {
    const task = this.transition.then(() => this.configure(config));
    this.transition = task.catch(() => undefined);
    return task;
  }

  private async configure(config: Pick<BotConfig, 'mode' | 'webhookUrl' | 'secretToken'>) {
    await this.bot.init();
    if (!this.streamLoop) {
      try {
        await this.redis.xgroup('CREATE', TELEGRAM_UPDATES_STREAM, GROUP, '0-0', 'MKSTREAM');
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('BUSYGROUP')) throw error;
      }
      this.streamLoop = this.consumeStream();
    }
    await this.runner?.stop();
    this.runner = undefined;
    if (config.mode === 'webhook') {
      await this.bot.api.setWebhook(config.webhookUrl, {
        secret_token: config.secretToken,
        allowed_updates: ALLOWED_UPDATES,
        drop_pending_updates: false,
        max_connections: 40,
      });
    } else {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      // A batch is durably stored before runner advances its Telegram offset.
      this.runner = run(
        {
          api: {
            getUpdates: async (args, signal) => {
              const updates = await this.bot.api.getUpdates(
                { ...args, allowed_updates: ALLOWED_UPDATES },
                signal,
              );
              for (const update of updates) await this.append(update);
              return updates;
            },
          },
          handleUpdate: () => Promise.resolve(),
          errorHandler: () => {
            throw new Error('Telegram ingress failed');
          },
        },
        { runner: { silent: true } },
      );
    }
  }

  async append(update: Update): Promise<void> {
    await this.redis.eval(
      APPEND,
      2,
      TELEGRAM_UPDATES_STREAM,
      `tg:received:${String(update.update_id)}`,
      JSON.stringify(update),
    );
  }

  async stop(): Promise<void> {
    await this.transition;
    this.stopping = true;
    await this.runner?.stop();
    await this.streamLoop;
    this.reader.disconnect();
  }

  private async consumeStream(): Promise<void> {
    while (!this.stopping) {
      try {
        const claimed = (await this.redis.xautoclaim(
          TELEGRAM_UPDATES_STREAM,
          GROUP,
          this.consumer,
          60_000,
          this.claimCursor,
          'COUNT',
          10,
        )) as [string, Array<[string, string[]]>];
        this.claimCursor = claimed[0];
        for (const [id, fields] of claimed[1]) await this.processMessage(id, fields);
        const batches = (await this.reader.xreadgroup(
          'GROUP',
          GROUP,
          this.consumer,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          TELEGRAM_UPDATES_STREAM,
          '>',
        )) as Array<[string, Array<[string, string[]]>]> | null;
        for (const [, messages] of batches ?? []) {
          for (const [id, fields] of messages) await this.processMessage(id, fields);
        }
      } catch {
        // Keep PEL entries for retry; never print the update payload or token.
        await delay(500);
      }
    }
  }

  private async processMessage(id: string, fields: string[]): Promise<void> {
    const payloadIndex = fields.indexOf('payload');
    const payload = payloadIndex < 0 ? undefined : fields[payloadIndex + 1];
    if (!payload) throw new Error('Invalid stream envelope');
    const update = JSON.parse(payload) as Update;
    if (!Number.isSafeInteger(update.update_id)) throw new Error('Invalid update ID');
    try {
      await this.bot.handleUpdate(update);
      await this.redis.xack(TELEGRAM_UPDATES_STREAM, GROUP, id);
    } catch {
      // Leave failed updates in the PEL while allowing the rest of the batch
      // to proceed. Domain mutations carry their own idempotency keys.
    }
  }
}
