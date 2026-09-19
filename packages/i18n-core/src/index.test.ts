import { describe, expect, it } from 'vitest';

import { botCatalogs, formatMessage } from './index.js';

describe('i18n core', () => {
  it('formats ICU plural messages for both supported locales', () => {
    expect(
      formatMessage('ru', botCatalogs.ru, 'bot.screen.trial.confirm', {
        days: 2,
        traffic: '10 ГБ',
      }),
    ).toContain('2 дня');
    expect(
      formatMessage('en', botCatalogs.en, 'bot.screen.trial.confirm', {
        days: 1,
        traffic: '10 GB',
      }),
    ).toContain('1 day');
  });

  it('falls back to the catalog key when a translation is missing', () => {
    expect(formatMessage('en', {}, 'missing.key')).toBe('missing.key');
  });
});
