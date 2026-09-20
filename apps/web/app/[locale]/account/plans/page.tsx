import { routing, type Locale } from '../../../../i18n/routing';
import PlansClient from './plans-client';

export default async function AccountPlansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
  return <PlansClient locale={locale} />;
}
