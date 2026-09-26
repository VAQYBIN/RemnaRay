import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getPublicConfig } from '../../../../lib/public-config';
import OpenClient from './open-client';

type Props = { params: Promise<{ locale: string; client: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const [t, config] = await Promise.all([getTranslations('seo'), getPublicConfig()]);
  return {
    title: t('openTitle', { brand: config.brand.name }),
    robots: { index: false, follow: false },
  };
}

/**
 * Section 13 `sub:clients`: Telegram URL buttons take only http(s) and tg://
 * links, so the bot's client buttons land here, and this page hands the
 * subscription link from the fragment to the client's deep link.
 */
export default async function OpenClientPage({ params }: Props) {
  const { client: id } = await params;
  const config = await getPublicConfig();
  const client = config.clients.find((item) => item.id === id);
  if (!client?.deepLinkTemplate) notFound();
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <OpenClient
        name={client.name}
        storeUrls={client.storeUrls}
        template={client.deepLinkTemplate}
      />
    </div>
  );
}
