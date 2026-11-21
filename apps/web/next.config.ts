import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  // The bench pages are now called evaluations. Old links and bookmarks keep working.
  redirects: async () => [
    { source: '/bench', destination: '/evaluations', permanent: true },
    { source: '/bench/:path*', destination: '/evaluations/:path*', permanent: true },
  ],
};

if (process.env.AVERO_WEB_STANDALONE === '1') {
  config.output = 'standalone';
  config.outputFileTracingRoot = resolve(import.meta.dirname, '../..');
}

export default config;
