import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupportService } from './support.service';

type Call = { method: string; body: Record<string, unknown> };

function harness(
  options: {
    chatId?: number | null;
    forum?: boolean;
    createTopic?: { ok: boolean; description?: string };
  } = {},
) {
  const store = new Map<string, string>();
  const redis = {
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    },
    del: (key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    },
  };
  const settings: Record<string, unknown> = {
    'brand.support_forward_chat_id': options.chatId === undefined ? -100500 : options.chatId,
    'bot.token': '123:token',
  };
  const calls: Call[] = [];
  let messageId = 10;
  let threadId = 70;
  vi.stubEnv('RR_TELEGRAM_API_URL', 'http://telegram.test');
  vi.stubGlobal('fetch', (url: string, init: { body: string }) => {
    const method = url.split('/').pop() ?? '';
    const body = JSON.parse(init.body) as Record<string, unknown>;
    calls.push({ method, body });
    const answer =
      method === 'getChat'
        ? { ok: true, result: { id: body['chat_id'], is_forum: options.forum === true } }
        : method === 'createForumTopic'
          ? options.createTopic && !options.createTopic.ok
            ? { ok: false, error_code: 400, description: options.createTopic.description }
            : { ok: true, result: { message_thread_id: ++threadId, name: body['name'] } }
          : { ok: true, result: { message_id: ++messageId } };
    return Promise.resolve(Response.json(answer));
  });
  const notify = { alert: vi.fn().mockResolvedValue({ delivered: 1, deduplicated: false }) };
  const db = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ firstName: 'Anna', username: 'anna', language: 'en' }),
    },
  };
  const service = new SupportService(
    { db, redis } as never,
    { get: (key: string) => Promise.resolve(settings[key]) } as never,
    notify as never,
  );
  return { service, calls, store, notify };
}

describe('SupportService (FR-124)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('refuses when no operators chat is configured, instead of pretending to deliver', async () => {
    const { service, calls } = harness({ chatId: null });
    await expect(service.forward('42', 'help')).rejects.toMatchObject({
      response: { error: { code: 'SUPPORT_UNAVAILABLE' } },
    });
    expect(calls).toEqual([]);
  });

  it('forwards to a plain group and routes a reply to the forwarded message back', async () => {
    const { service, calls } = harness();

    await service.forward('42', 'help');

    expect(calls.map((call) => call.method)).toEqual(['getChat', 'sendMessage']);
    expect(calls[1]?.body).toMatchObject({ chat_id: -100500, text: '#support 42 @anna\nhelp' });
    await expect(service.route({ chatId: -100500, replyToMessageId: 11 })).resolves.toEqual({
      telegramId: '42',
      language: 'en',
    });
    await expect(service.route({ chatId: -100500, replyToMessageId: 99 })).resolves.toBeNull();
    await expect(service.route({ chatId: -1, replyToMessageId: 11 })).resolves.toBeNull();
  });

  it('gives each customer a topic of their own in a forum and routes the topic back', async () => {
    const { service, calls } = harness({ forum: true });

    await service.forward('42', 'first');
    await service.forward('42', 'second');

    expect(calls.map((call) => call.method)).toEqual([
      'getChat',
      'createForumTopic',
      'sendMessage',
      'sendMessage',
    ]);
    expect(calls[1]?.body).toMatchObject({ chat_id: -100500, name: 'Anna · 42' });
    expect(calls[3]?.body).toMatchObject({
      message_thread_id: 71,
      text: '#support 42 @anna\nsecond',
    });
    await expect(service.route({ chatId: -100500, threadId: 71 })).resolves.toEqual({
      telegramId: '42',
      language: 'en',
    });
  });

  it('falls back to the chat and tells the administrators when topics cannot be created', async () => {
    const { service, calls, notify } = harness({
      forum: true,
      createTopic: { ok: false, description: 'Bad Request: not enough rights to create a topic' },
    });

    await service.forward('42', 'help');

    expect(calls.map((call) => call.method)).toEqual([
      'getChat',
      'createForumTopic',
      'sendMessage',
    ]);
    expect(calls[2]?.body).not.toHaveProperty('message_thread_id');
    expect(notify.alert).toHaveBeenCalledWith({
      type: 'support.topics',
      details: 'Bad Request: not enough rights to create a topic',
    });
  });
});
