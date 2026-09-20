import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { cssVariables, type ThemeTokens } from '@remnaray/theme-schema';
import { ToastProvider } from '@remnaray/ui';

import { getTheme } from '../../lib/theme';
import { routing, type Locale } from '../../i18n/routing';

import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Section 19.3 puts a per-response nonce in the CSP, and Next.js stamps that
 * nonce onto the inline scripts it emits only while it is rendering. Prerender
 * the page and the HTML carries inline scripts the nonce of the next request
 * does not cover, so the browser refuses them and the page never hydrates.
 *
 * The data stays cached: `revalidate` on the API fetches is what section 13.2
 * relies on, and what keeps the landing up when the API cannot answer.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return {
    title: theme.brand.name,
    description: theme.brand.tagline.en,
    metadataBase: new URL(
      process.env.RR_DOMAIN ? `https://${process.env.RR_DOMAIN}` : 'http://localhost:3000',
    ),
    icons: {
      icon: theme.assets['favicon'] ?? '/themes/manta/favicon.svg',
      apple: theme.assets['appleTouchIcon'] ?? '/themes/manta/apple-touch-icon.png',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  const theme = await getTheme();
  return (
    <html lang={locale}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle(theme) }} />
      </head>
      <body>
        <NextIntlClientProvider messages={await getMessages()}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function fontFaces(theme: ThemeTokens): string {
  return theme.typography.fonts
    .map(
      (font) =>
        `@font-face{font-family:${JSON.stringify(font.family)};src:url("/themes/${theme.slug}/${font.src}") format("woff2");font-weight:${String(font.weight)};font-style:${font.style};font-display:swap}`,
    )
    .join('');
}

function themeStyle(theme: ThemeTokens): string {
  const variables = {
    ...cssVariables(theme),
    '--font-sans': theme.typography.sans,
    '--font-mono': theme.typography.mono,
  };
  const root = Object.entries(variables)
    .filter(([name]) => !name.startsWith('--color-dark-'))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  const dark = Object.entries(variables)
    .filter(([name]) => name.startsWith('--color-dark-'))
    .map(([name, value]) => `--color-${name.slice('--color-dark-'.length)}:${value}`)
    .join(';');
  return `${fontFaces(theme)}:root{${root}}[data-theme="dark"]{${dark}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}`;
}
