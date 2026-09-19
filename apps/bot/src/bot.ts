import { autoRetry } from '@grammyjs/auto-retry';
import { limit } from '@grammyjs/ratelimiter';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { sequentialize } from '@grammyjs/runner';
import { Bot, session } from 'grammy';
import Redis from 'ioredis';

import { ApiClient } from './api-client.js';
import { BotI18n, normalizeLocale } from './i18n.js';
import { registerScreens } from './screens/index.js';
import type { BotConfig, BotSession, RrContext } from './types.js';

export type BotRuntime = {
  bot: Bot<RrContext>;
  api: ApiClient;
  redis: Redis;
  i18n: BotI18n;
};

const initialSession = (): BotSession => ({ lang: 'ru' });

export function createBot(
  options: { token?: string; api?: ApiClient; redis?: Redis } = {},
): BotRuntime {
  const api = options.api ?? new ApiClient();
  const redis =
    options.redis ??
    new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  const bot = new Bot<RrContext>(
    options.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '000000:disabled',
  );
  const i18n = new BotI18n(api);

  bot.api.config.use(autoRetry({ maxDelaySeconds: 60, maxRetryAttempts: 5 }));
  bot.use(sequentialize((ctx) => ctx.from?.id.toString()));
  bot.use(
    limit({
      timeFrame: 10_000,
      limit: 20,
      storageClient: redis,
      keyPrefix: 'rr:tg:limit:',
      keyGenerator: (ctx) => ctx.from?.id.toString(),
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
    if (ctx.session.lang === 'ru' && ctx.from.language_code) {
      ctx.session.lang = normalizeLocale(ctx.from.language_code) ?? ctx.session.lang;
    }
    const isStart = ctx.message?.text?.split(/\s+/u)[0]?.toLowerCase() === '/start';
    if (!ctx.session.userInitialized || isStart) {
      const payload = ctx.message?.text?.split(/\s+/u).slice(1).join(' ') || undefined;
      const result = await api.upsertUser({
        telegramId: ctx.from.id,
        ...(ctx.from.username ? { username: ctx.from.username } : {}),
        firstName: ctx.from.first_name,
        ...(ctx.from.language_code ? { languageCode: ctx.from.language_code } : {}),
        ...(payload ? { startPayload: payload } : {}),
      });
      ctx.session.lang = result.user.language;
      ctx.session.userInitialized = true;
    }
    await next();
  });
  bot.on('callback_query', async (ctx, next) => {
    await ctx.answerCallbackQuery();
    await next();
  });
  bot.catch((error) => {
    const updateId = error.ctx.update.update_id;
    const chatId = error.ctx.chat?.id;
    console.error('Telegram update failed', { updateId, chatId, error: error.error });
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
