import { GrammyError } from 'grammy';
import { describe, expect, it, vi } from 'vitest';

import { supportRelay } from './support.js';
import type { RrContext } from './types.js';

const catalogs: Record<string, Record<string, string>> = {
  ru: {
    'bot.screen.support.reply': 'Ответ поддержки: {text}',
    'bot.screen.support.undelivered': 'Не доставлено: {reason}',
  },
  en: { 'bot.screen.support.reply': 'Support replied: {text}' },
};

function relay(target: { telegramId: string; language: string } | null) {
  const routeSupport = vi.fn().mockResolvedValue({ target });
  const api = {
    getConfig: () => Promise.resolve({ supportForwardChatId: -100500, defaultLocale: 'ru' }),
    routeSupport,
  };
  const i18n = { catalog: (locale: string) => Promise.resolve(catalogs[locale] ?? {}) };
  return { middleware: supportRelay(api as never, i18n), routeSupport };
}

function update(message: Record<string, unknown>, sendMessage = vi.fn().mockResolvedValue({})) {
  const reply = vi.fn().mockResolvedValue({});
  const ctx = {
    chat: { id: -100500, type: 'supergroup' },
    message: { message_id: 5, from: { id: 7, is_bot: false }, ...message },
    api: { sendMessage },
    reply,
  } as unknown as RrContext;
  return { ctx, sendMessage, reply };
}

describe('support relay (FR-124)', () => {
  it("sends an answer written in a customer's topic to that customer, in their language", async () => {
    const { middleware, routeSupport } = relay({ telegramId: '42', language: 'en' });
    const { ctx, sendMessage } = update({
      text: 'We are on it',
      is_topic_message: true,
      message_thread_id: 71,
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(routeSupport).toHaveBeenCalledWith({ chatId: -100500, threadId: 71 });
    expect(sendMessage).toHaveBeenCalledWith(42, 'Support replied: We are on it', {
      parse_mode: 'HTML',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('routes a reply to a forwarded message in a plain group', async () => {
    const { middleware, routeSupport } = relay({ telegramId: '42', language: 'ru' });
    const { ctx, sendMessage } = update({ text: 'Готово', reply_to_message: { message_id: 11 } });

    await middleware(ctx, vi.fn());

    expect(routeSupport).toHaveBeenCalledWith({ chatId: -100500, replyToMessageId: 11 });
    expect(sendMessage).toHaveBeenCalledWith(42, 'Ответ поддержки: Готово', {
      parse_mode: 'HTML',
    });
  });

  it('tells the operators when the customer cannot be reached', async () => {
    const { middleware } = relay({ telegramId: '42', language: 'ru' });
    const blocked = new GrammyError(
      'blocked',
      { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' },
      'sendMessage',
      {},
    );
    const { ctx, reply } = update(
      { text: 'Hi', reply_to_message: { message_id: 11 } },
      vi.fn().mockRejectedValue(blocked),
    );

    await middleware(ctx, vi.fn());

    expect(reply).toHaveBeenCalledWith(
      'Не доставлено: Forbidden: bot was blocked by the user',
      expect.objectContaining({ reply_parameters: { message_id: 5 } }) as object,
    );
  });

  it('passes every other chat on to the customer handlers', async () => {
    const { middleware, routeSupport } = relay(null);
    const next = vi.fn();
    const { ctx } = update({ text: 'hello' });
    (ctx as unknown as { chat: { id: number; type: string } }).chat = { id: 42, type: 'private' };

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(routeSupport).not.toHaveBeenCalled();
  });

  it("delivers an operator's special characters as typed", async () => {
    const { middleware } = relay({ telegramId: '42', language: 'en' });
    const { ctx, sendMessage } = update({
      text: "Don't use <b> & co",
      reply_to_message: { message_id: 11 },
    });

    await middleware(ctx, vi.fn());

    // Escaped for HTML and sent as HTML: Telegram shows the original text.
    expect(sendMessage).toHaveBeenCalledWith(
      42,
      'Support replied: Don&#39;t use &lt;b&gt; &amp; co',
      { parse_mode: 'HTML' },
    );
  });
});
