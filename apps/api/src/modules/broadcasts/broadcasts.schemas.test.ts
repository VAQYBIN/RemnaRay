import { describe, expect, it } from 'vitest';

import { assertTelegramHtml, broadcastInputSchema } from './broadcasts.schemas';

const base = {
  title: 'Autumn',
  segment: { all: [] },
  content: { text: { ru: 'Привет' }, buttons: [], photo: null },
};

describe('broadcast content (section 16.3)', () => {
  it('accepts only the Telegram HTML tags the specification lists', () => {
    for (const tag of ['b', 'i', 'u', 's', 'code', 'pre', 'a', 'tg-spoiler', 'blockquote'])
      expect(() => {
        assertTelegramHtml(`<${tag}>text</${tag}>`);
      }).not.toThrow();

    for (const tag of ['script', 'div', 'img', 'iframe'])
      expect(() => {
        assertTelegramHtml(`<${tag}>text</${tag}>`);
      }).toThrow();
  });

  it('rejects a message that uses an unsupported tag', () => {
    expect(() =>
      broadcastInputSchema.parse({
        ...base,
        content: { ...base.content, text: { ru: '<script>alert(1)</script>' } },
      }),
    ).toThrow();
  });

  it('requires at least one language and allows a single one', () => {
    expect(() =>
      broadcastInputSchema.parse({ ...base, content: { ...base.content, text: {} } }),
    ).toThrow();
    expect(broadcastInputSchema.parse(base).content.text.ru).toBe('Привет');
  });

  it('allows at most four buttons of the supported kinds', () => {
    const button = { text: 'Open', type: 'url' as const, value: 'https://example.test' };
    expect(() =>
      broadcastInputSchema.parse({
        ...base,
        content: { ...base.content, buttons: [button, button, button, button, button] },
      }),
    ).toThrow();
    expect(
      broadcastInputSchema.parse({
        ...base,
        content: {
          ...base.content,
          buttons: [
            button,
            { text: 'Bot', type: 'deeplink', value: 'plan_basic' },
            { text: 'Menu', type: 'callback', value: 'home' },
          ],
        },
      }).content.buttons,
    ).toHaveLength(3);
  });

  it('validates the segment through the shared DSL', () => {
    expect(() =>
      broadcastInputSchema.parse({
        ...base,
        segment: { all: [{ field: 'user.unknown', op: 'eq', value: 'x' }] },
      }),
    ).toThrow();
  });
});
