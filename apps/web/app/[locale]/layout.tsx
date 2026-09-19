import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { cssVariables, themeSchema } from '@remnaray/theme-schema';
import manta from '../../../../themes/manta/theme.json';

import { routing, type Locale } from '../../i18n/routing';

import '../globals.css';

const theme = themeSchema.parse(manta);
const variables = cssVariables(theme);

export const metadata: Metadata = {
  title: 'RemnaRay',
  description: 'Telegram-first subscription shop for Remnawave panels',
  metadataBase: new URL(
    process.env.RR_DOMAIN ? `https://${process.env.RR_DOMAIN}` : 'http://localhost:3000',
  ),
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  return (
    <html lang={locale}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle() }} />
      </head>
      <body>
        <NextIntlClientProvider messages={await getMessages()}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

function themeStyle(): string {
  const root = Object.entries(variables)
    .filter(([name]) => !name.startsWith('--color-dark-'))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  const dark = Object.entries(variables)
    .filter(([name]) => name.startsWith('--color-dark-'))
    .map(([name, value]) => `--color-${name.slice('--color-dark-'.length)}:${value}`)
    .join(';');
  return `:root{${root}}[data-theme="dark"]{${dark}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}`;
}
