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
    { sourceTag: 'scope:agent', onlyDependOnLibsWithTags: ['type:contract'] },
  ],
};

export default defineConfig([
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist/**', '**/.next/**', '**/.nx/**', '**/next-env.d.ts', '**/.agent-sdk/**'],
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
    },
  },
  {
    files: ['apps/web/src/server/**/*.ts', 'apps/web/src/proxy.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          ...boundaries,
          allow: ['@avero/config', '@avero/db', '@avero/observability', '@avero/security'],
        },
      ],
    },
  },
]);
