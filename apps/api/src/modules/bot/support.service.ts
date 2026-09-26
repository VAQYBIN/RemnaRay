import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';
import { ApiError } from '../me/me.errors';
import { NotifyService } from '../notify/notify.service';
import { SettingsService } from '../settings/settings.service';

/** How long a plain forwarded message can still be answered by reply. */
const MESSAGE_TTL_SECONDS = 30 * 24 * 60 * 60;
const FORUM_TTL_SECONDS = 600;

class TelegramCallError extends Error {
  constructor(
    readonly method: string,
    readonly code: number | undefined,
    readonly description: string,
  ) {
    super(`${method}: ${description}`);
    this.name = 'TelegramCallError';
  }
}

export type SupportTarget = { telegramId: string; language: string };

/**
 * FR-124: a customer's message goes to the operators' chat
 * (`brand.support_forward_chat_id`), and an operator's answer goes back to
 * the customer. When that chat is a forum supergroup (the owner's choice),
 * every customer gets a topic of their own and anything written in it is the
 * answer; otherwise the answer is a reply to the forwarded message. The links
 * between Telegram messages and customers live in Valkey.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly infra: Infrastructure,
    private readonly settings: SettingsService,
    @Optional() private readonly notify?: NotifyService,
  ) {}

  async forward(telegramId: string, text: string): Promise<void> {
    const { chatId, token } = await this.destination();
    const user = await this.infra.db.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { firstName: true, username: true },
    });
    const header = `#support ${telegramId}${user?.username ? ` @${user.username}` : ''}`;
    const body = `${header}\n${text}`;
    try {
      if (await this.isForum(chatId, token)) {
        const name = `${user?.firstName ?? user?.username ?? 'user'} · ${telegramId}`.slice(0, 128);
        const sent = await this.sendToTopic(chatId, token, telegramId, name, body);
        if (sent) return;
      }
      const message = await this.call<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text: body,
      });
      await this.infra.redis.set(
        `rr:support:msg:${String(chatId)}:${String(message.message_id)}`,
        telegramId,
        'EX',
        MESSAGE_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(`support forward failed: ${String(error)}`);
      throw new ApiError('SUPPORT_UNAVAILABLE', HttpStatus.BAD_GATEWAY);
    }
  }

  /** The customer an operator's message in the operators' chat answers, if any. */
  async route(input: {
    chatId: number;
    threadId?: number | undefined;
    replyToMessageId?: number | undefined;
  }): Promise<SupportTarget | null> {
    const configured = await this.settings.get('brand.support_forward_chat_id');
    if (typeof configured !== 'number' || configured !== input.chatId) return null;
    const chat = String(input.chatId);
    const telegramId =
      (input.threadId === undefined
        ? null
        : await this.infra.redis.get(`rr:support:thread:${chat}:${String(input.threadId)}`)) ??
      (input.replyToMessageId === undefined
        ? null
        : await this.infra.redis.get(`rr:support:msg:${chat}:${String(input.replyToMessageId)}`));
    if (!telegramId) return null;
    const user = await this.infra.db.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { language: true },
    });
    return { telegramId, language: user?.language ?? 'ru' };
  }

  private async destination(): Promise<{ chatId: number; token: string }> {
    const [chatId, token] = await Promise.all([
      this.settings.get('brand.support_forward_chat_id'),
      this.settings.get('bot.token'),
    ]);
    if (typeof chatId !== 'number' || typeof token !== 'string' || !token)
      throw new ApiError('SUPPORT_UNAVAILABLE', HttpStatus.CONFLICT);
    return { chatId, token };
  }

  private async isForum(chatId: number, token: string): Promise<boolean> {
    const key = `rr:support:forum:${String(chatId)}`;
    const cached = await this.infra.redis.get(key);
    if (cached !== null) return cached === '1';
    const chat = await this.call<{ is_forum?: boolean }>(token, 'getChat', { chat_id: chatId });
    const forum = chat.is_forum === true;
    await this.infra.redis.set(key, forum ? '1' : '0', 'EX', FORUM_TTL_SECONDS);
    return forum;
  }

  /**
   * Sends into the customer's topic, creating it on the first message and
   * again when an operator deleted it. False when the bot may not manage
   * topics: the message then goes to the chat itself and the administrators
   * are told which right is missing.
   */
  private async sendToTopic(
    chatId: number,
    token: string,
    telegramId: string,
    name: string,
    text: string,
  ): Promise<boolean> {
    const key = `rr:support:topic:${String(chatId)}:${telegramId}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let threadId = Number(await this.infra.redis.get(key)) || undefined;
      if (threadId === undefined) {
        try {
          const topic = await this.call<{ message_thread_id: number }>(token, 'createForumTopic', {
            chat_id: chatId,
            name,
          });
          threadId = topic.message_thread_id;
        } catch (error) {
          if (!(error instanceof TelegramCallError)) throw error;
          this.logger.warn(`support topic not created: ${error.description}`);
          await this.notify
            ?.alert({ type: 'support.topics', details: error.description.slice(0, 300) })
            .catch(() => undefined);
          return false;
        }
        await this.infra.redis.set(key, String(threadId));
        await this.infra.redis.set(
          `rr:support:thread:${String(chatId)}:${String(threadId)}`,
          telegramId,
        );
      }
      try {
        await this.call(token, 'sendMessage', {
          chat_id: chatId,
          message_thread_id: threadId,
          text,
        });
        return true;
      } catch (error) {
        // An operator deleted the topic: start a new one once.
        if (error instanceof TelegramCallError && /thread not found/iu.test(error.description)) {
          await this.infra.redis.del(key);
          continue;
        }
        throw error;
      }
    }
    return false;
  }

  private async call<T = unknown>(
    token: string,
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const base = process.env.RR_TELEGRAM_API_URL ?? 'https://api.telegram.org';
    const response = await fetch(`${base}/bot${encodeURIComponent(token)}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      error_code?: number;
      description?: string;
    };
    if (!payload.ok || payload.result === undefined)
      throw new TelegramCallError(
        method,
        payload.error_code,
        payload.description ?? `HTTP ${String(response.status)}`,
      );
    return payload.result;
  }
}
