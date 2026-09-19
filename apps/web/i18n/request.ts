import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';

import { loadLocaleMessages } from './messages';
import { routing } from './routing';

export default getRequestConfig(async () => {
  const requested = await rootLocale();
  const locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;
  return { locale, messages: loadLocaleMessages(locale) };
});

type Locale = (typeof routing.locales)[number];
