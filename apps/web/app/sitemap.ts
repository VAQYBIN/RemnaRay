import type { MetadataRoute } from 'next';

import { getPublicConfig } from '../lib/public-config';
import { routing } from '../i18n/routing';

const pages = ['', '/terms', '/privacy', '/offer'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = process.env.RR_DOMAIN ? `https://${process.env.RR_DOMAIN}` : 'http://localhost:3000';
  const config = await getPublicConfig();
  const locales = routing.locales.filter((locale) => config.locales.enabled.includes(locale));
  const enabled = locales.length > 0 ? locales : [...routing.locales];
  const defaultLocale = enabled.includes(config.locales.default as (typeof enabled)[number])
    ? config.locales.default
    : routing.defaultLocale;

  return enabled.flatMap((locale) =>
    pages.map((page) => ({
      url: `${host}/${locale}${page}`,
      lastModified: new Date(),
      alternates: {
        languages: {
          ...Object.fromEntries(enabled.map((item) => [item, `${host}/${item}${page}`])),
          'x-default': `${host}/${defaultLocale}${page}`,
        },
      },
    })),
  );
}
