import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getTranslations } from 'next-intl/server';

import { markdownToHtml } from '../../lib/markdown';
import { Link } from '../../i18n/navigation';
import { routing, type Locale } from '../../i18n/routing';
import { localeRoot } from '../../i18n/messages';

export async function LegalPage({
  params,
  document,
}: {
  params: Promise<{ locale: string }>;
  document: 'terms' | 'privacy' | 'offer';
}) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  const t = await getTranslations('legal');
  const source = await readFile(join(localeRoot, locale, 'legal', `${document}.md`), 'utf8');
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-primary">
        {t('back')}
      </Link>
      <article
        className="prose prose-slate mt-8 max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(source) }}
      />
    </main>
  );
}
