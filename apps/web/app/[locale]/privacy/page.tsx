import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalPage } from '../legal-page';
import { routing, type Locale } from '../../../i18n/routing';

type Props = { params: Promise<{ locale: string }> };
export const revalidate = 300;
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return { title: t('privacyTitle'), robots: { index: true, follow: true } };
}
export default function PrivacyPage({ params }: Props) {
  return <LegalPage params={params} document="privacy" />;
}
