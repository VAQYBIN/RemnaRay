import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getPublicConfig } from '../../../../lib/public-config';
import { routing, type Locale } from '../../../../i18n/routing';
import PayStatus from './pay-status';

type Props = { params: Promise<{ locale: string; invoiceId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const [t, config] = await Promise.all([getTranslations('seo'), getPublicConfig()]);
  return {
    title: t('payTitle', { brand: config.brand.name }),
    robots: { index: false, follow: false },
  };
}

export default async function PayPage({ params }: Props) {
  const { locale: value, invoiceId } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  const config = await getPublicConfig();
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <PayStatus botUsername={config.brand.botUsername} invoiceId={invoiceId} locale={locale} />
    </div>
  );
}
