import { routing, type Locale } from '../../../i18n/routing';
import SubscriptionClient from './subscription-client';

export default async function AccountSubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  return <SubscriptionClient locale={locale} />;
}
