import type { Context, SessionFlavor } from 'grammy';

import type { Locale } from '@remnaray/i18n-core';

export type BotSession = {
  lang: Locale;
  menuMessageId?: number;
  pendingPromo?: string;
  lastInvoiceId?: string;
  awaitingEmailForInvoice?: string;
  userInitialized?: boolean;
};

export type I18nFlavor = {
  locale: Locale;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export type RrContext = Context & SessionFlavor<BotSession> & I18nFlavor;

export const ALLOWED_UPDATES = [
  'message',
  'callback_query',
  'pre_checkout_query',
  'my_chat_member',
] as const;

export type BotConfig = {
  mode: 'webhook' | 'polling';
  webhookUrl: string;
  secretPath: string;
  secretToken: string;
  locales: Locale[];
  commands: Record<Locale, Array<{ command: string; description: string }>>;
  adminCommands: Record<Locale, Array<{ command: string; description: string }>>;
  supportForwardChatId: number | null;
  admins: string[];
};

export type TelegramUpdate = {
  update_id: number;
  [key: string]: unknown;
};
