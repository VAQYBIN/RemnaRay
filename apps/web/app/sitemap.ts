import type { MetadataRoute } from 'next';

const locales = ['ru', 'en'] as const;
const pages = ['', '/terms', '/privacy', '/offer'];

export default function sitemap(): MetadataRoute.Sitemap {
  const host = process.env.RR_DOMAIN ? `https://${process.env.RR_DOMAIN}` : 'http://localhost:3000';
  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${host}/${locale}${page}`,
      lastModified: new Date(),
      alternates: {
        languages: Object.fromEntries(locales.map((item) => [item, `${host}/${item}${page}`])),
      },
    })),
  );
}
