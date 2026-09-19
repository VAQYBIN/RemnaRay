import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    localPatterns: [
      // Section 18.2 serves theme assets as `/themes/<slug>/<asset>?v=<version>`;
      // Next.js 16 rejects a local image with a query string unless the path is
      // allowed here. The route handler resolves only the theme's own files, so
      // an arbitrary query cannot address anything else.
      { pathname: '/themes/**' },
      { pathname: '/**', search: '' },
    ],
  },
  outputFileTracingIncludes: {
    '/*': ['../../locales/**/*', '../../themes/**/*'],
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
