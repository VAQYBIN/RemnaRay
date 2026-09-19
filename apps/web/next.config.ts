import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['../../locales/**/*', '../../themes/**/*'],
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
