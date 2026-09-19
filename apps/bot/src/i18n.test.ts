import { describe, expect, it, vi } from 'vitest';

import { BotI18n } from './i18n.js';

function client(messages: Record<string, string>) {
  const getMessages = vi.fn().mockResolvedValue({ lang: 'ru', messages });
  return { api: { getMessages } as never, getMessages };
}

describe('AC-181: an override reaches the bot within sixty seconds', () => {
  it('caches a catalog for at most sixty seconds', async () => {
    const test = client({ 'bot.btn.buy': 'Купить' });
    const i18n = new BotI18n(test.api);

    await i18n.catalog('ru');
    await i18n.catalog('ru');
    expect(test.getMessages).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 61_000);
      await i18n.catalog('ru');
      expect(test.getMessages).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the cache immediately on rr:i18n.changed', async () => {
    const test = client({ 'bot.btn.buy': 'Купить' });
    const i18n = new BotI18n(test.api);

    await i18n.catalog('ru');
    i18n.invalidate();
    await i18n.catalog('ru');

    expect(test.getMessages).toHaveBeenCalledTimes(2);
  });
});
