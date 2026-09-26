import type { ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, show } from './common.js';

const PLATFORMS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

/**
 * `/help` (section 12 commands): how to connect, the supported clients and the
 * FAQ. The steps and the FAQ are the landing page's own locale keys
 * (`landing.steps`, `landing.faq`), so one edit in «Локали» changes both; the
 * clients are `settings.clients.items`.
 */
export async function showHelp(ctx: RrContext, api: ApiClient): Promise<void> {
  const { clients } = await api.getConfig();
  const steps = list<string>(ctx.messages['landing.steps']).filter(
    (step) => typeof step === 'string',
  );
  const faq = list<{ question?: unknown; answer?: unknown }>(ctx.messages['landing.faq']).filter(
    (item) => typeof item.question === 'string' && typeof item.answer === 'string',
  );
  const sections = [
    `<b>${escape(ctx.t('bot.screen.help.title'))}</b>`,
    steps.map((step, index) => `${String(index + 1)}. ${escape(step)}`).join('\n'),
    clients.length > 0
      ? `<b>${escape(ctx.t('bot.screen.help.clients'))}</b>\n${clients
          .map(
            (client) =>
              `${escape(client.name)} — ${client.platforms.map((item) => PLATFORMS[item] ?? item).join(', ')}`,
          )
          .join('\n')}`
      : '',
    faq.length > 0
      ? `<b>${escape(ctx.t('bot.screen.help.faq'))}</b>\n\n${faq
          .map((item) => `<b>${escape(String(item.question))}</b>\n${escape(String(item.answer))}`)
          .join('\n\n')}`
      : '',
    escape(ctx.t('bot.screen.help.more')),
  ];
  await show(ctx, sections.filter(Boolean).join('\n\n'), backButton(ctx));
}

function list<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** The screen is HTML (`show` sends `parse_mode: HTML`); locale texts are text. */
function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
