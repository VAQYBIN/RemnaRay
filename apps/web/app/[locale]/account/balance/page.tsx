import { routing, type Locale } from '../../../../i18n/routing';
import Client from './balance-client';

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  return <Client locale={locale} />;
}
