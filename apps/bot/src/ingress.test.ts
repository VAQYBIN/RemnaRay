import { Bot, BotError } from 'grammy';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BotIngress } from './ingress.js';
import type { RrContext } from './types.js';

const botInfo = {
  id: 1,
  is_bot: true as const,
  first_name: 'Shop',
  username: 'shop_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
};

const update = {
  update_id: 5,
  message: {
    message_id: 1,
    date: 0,
    chat: { id: 42, type: 'private' as const, first_name: 'Ann' },
    from: { id: 42, is_bot: false, first_name: 'Ann' },
    text: 'Профиль',
  },
};

function harness() {
  const bot = new Bot<RrContext>('123:token', { botInfo: botInfo as never });
  const redis = {
    duplicate: () => ({ disconnect: vi.fn() }),
    xack: vi.fn().mockResolvedValue(1),
  };
  const ingress = new BotIngress(bot, redis as never, 'test-consumer');
  const deliver = () =>
    (
      ingress as unknown as { processMessage(id: string, fields: string[]): Promise<void> }
    ).processMessage('1-0', ['payload', JSON.stringify(update)]);
  return { bot, redis, deliver };
}

describe('BotIngress failed updates (FR-127)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('hands a handler error to bot.catch and acknowledges the update', async () => {
    const { bot, redis, deliver } = harness();
    bot.use(() => {
      throw new Error('boom');
    });
    const handled: BotError[] = [];
    bot.catch((error) => {
      handled.push(error);
    });

    await deliver();

    expect(handled).toHaveLength(1);
    expect(handled[0]).toBeInstanceOf(BotError);
    expect(handled[0]?.ctx.update.update_id).toBe(5);
    // Answered and logged: redelivering it every 60 s would repeat the
    // handler's side effects and the error reply.
    expect(redis.xack).toHaveBeenCalledWith('tg:updates', 'bot', '1-0');
  });

  it('logs an error handler that fails itself, without the update, and acknowledges', async () => {
    const { bot, redis, deliver } = harness();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bot.use(() => {
      throw new Error('boom');
    });
    bot.catch(() => {
      throw new Error('handler down');
    });

    await deliver();

    expect(log).toHaveBeenCalledWith('Telegram error handler failed', {
      updateId: 5,
      error: 'Error',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('Профиль');
    expect(redis.xack).toHaveBeenCalledWith('tg:updates', 'bot', '1-0');
  });
});
