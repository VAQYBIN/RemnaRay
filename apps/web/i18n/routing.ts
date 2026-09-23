import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'en'],
  defaultLocale: 'ru',
  localePrefix: 'always',
  localeCookie: { name: 'rr_lang', maxAge: 60 * 60 * 24 * 365, secure: true },
});

export type Locale = (typeof routing.locales)[number];
