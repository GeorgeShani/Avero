import nx from '@nx/eslint-plugin';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig } from 'eslint/config';

const boundaries = {
  allow: [],
  banTransitiveDependencies: true,
  depConstraints: [
    { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['scope:shared'] },
    { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
    { sourceTag: 'runtime:browser', onlyDependOnLibsWithTags: ['runtime:browser'] },
    {
      sourceTag: 'type:ui',
      notDependOnLibsWithTags: ['type:data-access', 'type:integration', 'runtime:node'],
    },
    { sourceTag: 'scope:agent', onlyDependOnLibsWithTags: ['type:contract'] },
  ],
};

const internalImports = {
  patterns: [
    {
      group: ['@avero/*/**', '!@avero/ui/**'],
      message: 'Import another package through its public entry point, not its internals.',
    },
  ],
};

export default defineConfig([
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      'packages/ui/src/primitives/**',
      '**/dist/**',
      '**/.next/**',
      '**/.nx/**',
      '**/next-env.d.ts',
      '**/.agent-sdk/**',
    ],
  },
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    extends: [nextVitals],
  },
  {
    files: [
      'apps/**/src/**/*.{ts,tsx}',
      'apps/agent-service/{bot,evals}/**/*.ts',
      'packages/**/src/**/*.{ts,tsx}',
    ],
    rules: {
      '@nx/enforce-module-boundaries': ['error', boundaries],
      'no-restricted-imports': ['error', internalImports],
    },
  },
  {
    files: ['apps/web/src/server/**/*.ts', 'apps/web/src/proxy.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          ...boundaries,
          allow: [
            '@avero/config',
            '@avero/db',
            '@avero/github',
            '@avero/observability',
            '@avero/run-store',
            '@avero/security',
          ],
        },
      ],
    },
  },
  {
    // The console reads its data through the RunSource that server/run-source.ts returns, so the
    // same pages can serve local files now and the database later. Nothing else in the web app
    // reaches for the file store directly.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/server/run-source.ts', 'apps/web/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...internalImports,
          paths: [
            {
              name: '@avero/run-store',
              message:
                'Read runs through runSource() from server/run-source.ts, so the console works over files and the database alike.',
            },
          ],
        },
      ],
    },
  },
]);
