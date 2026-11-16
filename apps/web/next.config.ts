import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = { poweredByHeader: false };

if (process.env.AVERO_WEB_STANDALONE === '1') {
  config.output = 'standalone';
  config.outputFileTracingRoot = resolve(import.meta.dirname, '../..');
}

export default config;
