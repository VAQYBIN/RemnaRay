import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';
import { getFormatter, getTranslations } from 'next-intl/server';

import { serverApi } from '../../lib/api';
import { getPublicConfig } from '../../lib/public-config';
import { localeRoot } from '../../i18n/messages';
import { markdownToHtml } from '../../lib/markdown';
import { Link } from '../../i18n/navigation';
import { routing, type Locale } from '../../i18n/routing';
import SiteFooter from './site-footer';

const legalSchema = z.object({
  doc: z.string(),
  lang: z.string(),
  markdown: z.string(),
  updatedAt: z.string().nullable(),
});

export type LegalDocument = 'terms' | 'privacy' | 'offer';

type Legal = z.infer<typeof legalSchema>;

/**
 * Legal texts come from `GET /api/v1/public/legal/:doc`, which applies the admin
 * override and substitutes `{brand}`, `{domain}` and `{support}`. The shipped
 * file is used only when the API is unreachable, for example while prerendering.
 */
async function loadLegal(document: LegalDocument, locale: Locale): Promise<Legal> {
  try {
    return await serverApi().get(`api/v1/public/legal/${document}`, legalSchema, {
      query: { lang: locale },
      next: { revalidate: 300, tags: ['legal'] },
    });
  } catch {
    return fallbackLegal(document, locale);
  }
}

async function fallbackLegal(document: LegalDocument, locale: Locale): Promise<Legal> {
  const config = await getPublicConfig();
  const file = join(localeRoot, locale, 'legal', `${document}.md`);
  const markdown = existsSync(file) ? readFileSync(file, 'utf8') : '';
  return {
    doc: document,
    lang: locale,
    markdown: markdown
      .replaceAll('{brand}', config.brand.name)
      .replaceAll('{domain}', process.env.RR_DOMAIN ?? 'localhost')
      .replaceAll('{support}', config.brand.supportContact),
    updatedAt: existsSync(file) ? statSync(file).mtime.toISOString() : null,
  };
}

export async function LegalPage({
  params,
  document,
}: {
  params: Promise<{ locale: string }>;
  document: LegalDocument;
}) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  const [t, formatter, legal] = await Promise.all([
    getTranslations('legal'),
    getFormatter({ locale }),
    loadLegal(document, locale),
  ]);

  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link className="text-sm text-primary" href="/">
          {t('back')}
        </Link>
        {legal.updatedAt ? (
          <p className="mt-6 text-xs text-muted-foreground">
            {t('updatedAt', {
              date: formatter.dateTime(new Date(legal.updatedAt), {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
            })}
          </p>
        ) : null}
        <article
          className="prose prose-slate mt-4 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(legal.markdown) }}
        />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
