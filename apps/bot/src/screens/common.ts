import { InlineKeyboard } from 'grammy';

import type { RrContext } from '../types.js';

export function button(ctx: RrContext, key: string, data: string): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t(key), data);
}

export function backButton(ctx: RrContext, data = 'home'): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t('bot.btn.back'), data);
}

export async function show(ctx: RrContext, text: string, keyboard?: InlineKeyboard): Promise<void> {
  if (ctx.callbackQuery?.message) {
    try {
      const message = await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...(keyboard ? { reply_markup: keyboard } : {}),
      });
      if (message !== true && 'message_id' in message)
        ctx.session.menuMessageId = message.message_id;
      return;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("can't be edited")) throw error;
    }
  }
  const message = await ctx.reply(text, {
    parse_mode: 'HTML',
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
  ctx.session.menuMessageId = message.message_id;
}

export function formatMinor(amountMinor: string | number, currency = 'RUB'): string {
  const amount = Number(amountMinor) / 100;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(amount);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}
