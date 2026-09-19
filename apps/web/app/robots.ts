import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const host = process.env.RR_DOMAIN ? `https://${process.env.RR_DOMAIN}` : 'http://localhost:3000';
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/account', '/pay', '/admin', '/setup'] },
    sitemap: `${host}/sitemap.xml`,
  };
}
