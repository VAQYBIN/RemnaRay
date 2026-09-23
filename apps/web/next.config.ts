import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // The production image is built in constrained Docker environments. A
  // single static-generation worker avoids concurrent page renders exhausting
  // the builder while preserving the generated routes and runtime behavior.
  experimental: {
    staticGenerationMaxConcurrency: 1,
  },
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
