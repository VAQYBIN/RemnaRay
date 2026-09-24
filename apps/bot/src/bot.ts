import { autoRetry } from '@grammyjs/auto-retry';
import { limit } from '@grammyjs/ratelimiter';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { sequentialize } from '@grammyjs/runner';
import { Bot, session } from 'grammy';
import { GrammyError, HttpError, type Transformer } from 'grammy';
import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';

import { ApiClient } from './api-client.js';
import { BotI18n } from './i18n.js';
import { registerScreens } from './screens/index.js';
import { isPaymentUpdate, registerStars } from './screens/stars.js';
import { installConversations } from './conversations.js';
import type { BotConfig, BotSession, RrContext } from './types.js';

export type BotRuntime = {
  bot: Bot<RrContext>;
  api: ApiClient;
  redis: Redis;
  i18n: BotI18n;
};

const THROTTLED_METHODS = new Set(['sendMessage', 'editMessageText', 'sendPhoto', 'sendInvoice']);

export function outgoingThrottle(): Transformer {
  let chain = Promise.resolve();
  let globalReadyAt = 0;
  const chatReadyAt = new Map<string, number>();
  return (prev, method, payload, signal) => {
    if (!THROTTLED_METHODS.has(method)) return prev(method, payload, signal);
    const value = payload as Record<string, unknown>;
    const chatId =
      typeof value.chat_id === 'number' || typeof value.chat_id === 'string'
        ? String(value.chat_id)
        : undefined;
    const task = chain.then(async () => {
      const now = Date.now();
      const chatAt = chatId ? (chatReadyAt.get(chatId) ?? 0) : 0;
      const wait = Math.max(globalReadyAt - now, chatAt - now);
      if (wait > 0) await new Promise<void>((resolve) => setTimeout(resolve, wait));
      const sentAt = Date.now();
      globalReadyAt = sentAt + 34;
      if (chatId) chatReadyAt.set(chatId, sentAt + 1000);
      return prev(method, payload, signal);
    });
    chain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
}

export function incidentId(): string {
  return randomBytes(6).toString('base64url').slice(0, 8);
}

const initialSession = (): BotSession => ({ lang: 'ru' });

export function createBot(options: {
  token: string;
  api?: ApiClient;
  redis?: Redis;
  apiRoot?: string;
}): BotRuntime {
  const api = options.api ?? new ApiClient();
  const redis =
    options.redis ??
    new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  const bot = new Bot<RrContext>(
    options.token,
    options.apiRoot ? { client: { apiRoot: options.apiRoot } } : {},
  );
  const i18n = new BotI18n(api);

  bot.api.config.use(autoRetry({ maxDelaySeconds: 60, maxRetryAttempts: 5 }));
  bot.api.config.use(outgoingThrottle());
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
    if (ctx.from) await next();
  });
  bot.use(sequentialize((ctx) => ctx.from?.id.toString()));
  bot.use(
    limit({
      timeFrame: 10_000,
      limit: 20,
      storageClient: redis,
      keyPrefix: 'rr:tg:limit:',
      // Stars payment updates are never limited (section 11.3.6).
      keyGenerator: (ctx) => (isPaymentUpdate(ctx) ? undefined : ctx.from?.id.toString()),
    }),
  );
  bot.use(
    session({
      initial: initialSession,
      getSessionKey: (ctx) => ctx.from?.id.toString(),
      prefix: 'tg:sess:',
      storage: new RedisAdapter<BotSession>({ instance: redis, ttl: 30 * 24 * 60 * 60 }),
    }),
  );
  bot.use(i18n.middleware());
  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    const isStart = /^\/start(?:@\w+)?(?:\s|$)/u.test(ctx.message?.text ?? '');
    if (!ctx.session.userInitialized || isStart) {
      const payload = isStart ? ctx.message?.text?.split(/\s+/u).slice(1).join(' ') : undefined;
      const result = await api.upsertUser({
        telegramId: ctx.from.id,
        ...(ctx.from.username ? { username: ctx.from.username } : {}),
        firstName: ctx.from.first_name,
        ...(ctx.from.language_code ? { languageCode: ctx.from.language_code } : {}),
        ...(payload ? { startPayload: payload } : {}),
      });
      ctx.session.lang = result.user.language;
      ctx.session.userInitialized = true;
      await i18n.bind(ctx, result.user.language);
    }
    await next();
  });
  // Before conversations: an open dialog must not swallow `successful_payment`.
  registerStars(bot, api);
  installConversations(bot, redis, api);
  bot.catch(async (error) => {
    const updateId = error.ctx.update.update_id;
    const chatId = error.ctx.chat?.id;
    const telegramError =
      error.error instanceof GrammyError
        ? {
            code: error.error.error_code,
            description: error.error.description,
          }
        : error.error instanceof HttpError
          ? { code: undefined, description: 'http_error' }
          : { code: undefined, description: 'handler_error' };
    console.error('Telegram update failed', { updateId, chatId, ...telegramError });
    if (telegramError.code === 403 && error.ctx.from) {
      await api.markBlocked(error.ctx.from.id).catch(() => undefined);
      return;
    }
    if (telegramError.code === 429) return;
    if (error.ctx.from) {
      const id = incidentId();
      await error.ctx
        .reply(error.ctx.t('bot.error.generic', { incidentId: id }))
        .catch(() => undefined);
    }
  });
  registerScreens(bot, api);
  return { bot, api, redis, i18n };
}

export async function registerCommands(bot: Bot<RrContext>, config: BotConfig): Promise<void> {
  for (const locale of config.locales) {
    await bot.api.setMyCommands(config.commands[locale], { language_code: locale });
  }
  const adminCommands = [...config.adminCommands.ru];
  for (const telegramId of config.admins) {
    await bot.api.setMyCommands(adminCommands, {
      scope: { type: 'chat', chat_id: Number(telegramId) },
    });
  }
}
