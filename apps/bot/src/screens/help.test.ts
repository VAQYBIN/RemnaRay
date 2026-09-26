import { describe, expect, it } from 'vitest';

import { showHelp } from './help.js';
import type { RrContext } from '../types.js';

describe('bot /help (section 12 commands)', () => {
  it('shows the connection steps, the clients and the FAQ the landing page shows', async () => {
    const texts: string[] = [];
    const messages: Record<string, string> = {
      'landing.steps': JSON.stringify(['Откройте бота.', 'Оплатите тариф.']),
      'landing.faq': JSON.stringify([{ question: 'Нужна карта?', answer: 'Нет.' }]),
    };
    const ctx = {
      from: { id: 123 },
      session: {},
      messages,
      t: (key: string, values: Record<string, unknown> = {}) =>
        Object.keys(values).length > 0 ? `${key} ${JSON.stringify(values)}` : key,
      reply: (text: string) => {
        texts.push(text);
        return { message_id: 1 };
      },
    } as unknown as RrContext;
    const api = {
      getConfig: () => ({
        clients: [
          { name: 'Happ', platforms: ['ios', 'android'] },
          { name: 'Hiddify', platforms: ['windows'] },
        ],
      }),
    } as never;

    await showHelp(ctx, api);

    const text = texts[0] ?? '';
    expect(text).toContain('1. Откройте бота.');
    expect(text).toContain('2. Оплатите тариф.');
    expect(text).toContain('Happ — iOS, Android');
    expect(text).toContain('Hiddify — Windows');
    expect(text).toContain('<b>Нужна карта?</b>\nНет.');
  });
});
