import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getPublicConfig } from '../../../lib/public-config';
import { routing, type Locale } from '../../../i18n/routing';
import AccountNav from './account-nav';

export async function generateMetadata(): Promise<Metadata> {
  const [t, config] = await Promise.all([getTranslations('seo'), getPublicConfig()]);
  return {
    title: t('accountTitle', { brand: config.brand.name }),
    robots: { index: false, follow: false },
  };
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  const config = await getPublicConfig();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <AccountNav
        locale={locale}
        showReferrals={config.features.referral}
        showTopUp={config.features.topup}
      />
      <main>{children}</main>
    </div>
  );
}
