import type { Bot } from 'grammy';
import { run, type RunnerHandle } from '@grammyjs/runner';
import type Redis from 'ioredis';

import type { BotConfig, RrContext, TelegramUpdate } from './types.js';

export const TELEGRAM_UPDATES_STREAM = 'tg:updates';
const CONSUMER_GROUP = 'bot';

export class BotIngress {
  private runner?: RunnerHandle;
  private streamLoop?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly bot: Bot<RrContext>,
    private readonly redis: Redis,
    private readonly consumer = `bot-${String(process.pid)}`,
  ) {}

  async start(config: Pick<BotConfig, 'mode' | 'webhookUrl' | 'secretToken'>): Promise<void> {
    await this.stop();
    this.stopping = false;
    if (config.mode === 'polling') {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      this.runner = run(this.bot, {
        runner: {
          fetch: {
            allowed_updates: ['message', 'callback_query', 'pre_checkout_query', 'my_chat_member'],
          },
        },
      });
      return;
    }
    await this.bot.api.setWebhook(config.webhookUrl, {
      secret_token: config.secretToken,
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query', 'my_chat_member'],
      drop_pending_updates: false,
      max_connections: 40,
    });
    await this.ensureGroup();
    this.streamLoop = this.consumeStream();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.runner) {
      await this.runner.stop();
      delete this.runner;
    }
    await this.streamLoop;
    delete this.streamLoop;
  }

  private async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', TELEGRAM_UPDATES_STREAM, CONSUMER_GROUP, '0-0', 'MKSTREAM');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('BUSYGROUP')) throw error;
    }
  }

  private async consumeStream(): Promise<void> {
    while (!this.stopping) {
      await this.claimStale();
      const batches = (await this.redis.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        this.consumer,
        'COUNT',
        10,
        'BLOCK',
        5000,
        'STREAMS',
        TELEGRAM_UPDATES_STREAM,
        '>',
      )) as Array<[string, Array<[string, string[]]>]> | null;
      if (!batches) continue;
      for (const [, messages] of batches) {
        for (const [id, fields] of messages) await this.processMessage(id, fields);
      }
    }
  }

  private async claimStale(): Promise<void> {
    const claimed = (await this.redis.xautoclaim(
      TELEGRAM_UPDATES_STREAM,
      CONSUMER_GROUP,
      this.consumer,
      60_000,
      '0-0',
      'COUNT',
      10,
    )) as [string, Array<[string, string[]]>] | null;
    for (const [id, fields] of claimed?.[1] ?? []) await this.processMessage(id, fields);
  }

  private async processMessage(id: string, fields: string[]): Promise<void> {
    const payloadIndex = fields.findIndex((field) => field === 'payload');
    const payload = payloadIndex >= 0 ? fields[payloadIndex + 1] : undefined;
    if (!payload) {
      await this.redis.xack(TELEGRAM_UPDATES_STREAM, CONSUMER_GROUP, id);
      return;
    }
    try {
      const update = JSON.parse(payload) as TelegramUpdate;
      if (typeof update.update_id !== 'number') throw new Error('Invalid Telegram update');
      await this.bot.handleUpdate(update);
      await this.redis.xack(TELEGRAM_UPDATES_STREAM, CONSUMER_GROUP, id);
    } catch (error) {
      this.bot.errorHandler(error as never);
    }
  }
}
