#!/usr/bin/env node
/**
 * Builds the publishable `avero` package into dist-npm/avero: the CLI, the bench, the share
 * bundle and the MCP server bundled into a few files, with the Cursor SDK left as the one real
 * dependency (it ships native binaries per platform, so it must be installed, not bundled).
 *
 *   pnpm build:npm            builds dist-npm/avero
 *   cd dist-npm/avero && npm pack      makes the tarball you would publish
 *
 * This script never publishes.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { runNx } from './run-command.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'dist-npm', 'avero');
const cli = JSON.parse(readFileSync(join(root, 'apps/cli/package.json'), 'utf8'));
const engine = JSON.parse(readFileSync(join(root, 'packages/coding-engine/package.json'), 'utf8'));
const sdkVersion = engine.dependencies?.['@cursor/sdk'];
if (!sdkVersion) throw new Error('Could not find the @cursor/sdk version to depend on.');

runNx(['build', '@avero/cli', '--output-style=static']);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: { avero: join(root, 'apps/cli/src/index.ts') },
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  external: ['@cursor/sdk'],
  // Some bundled dependencies are CommonJS and call require().
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
  legalComments: 'none',
  logLevel: 'warning',
});

const version = process.env.AVERO_VERSION ?? '0.1.0';
writeFileSync(
  join(out, 'package.json'),
  `${JSON.stringify(
    {
      name: 'avero',
      version,
      description:
        'Flight recorder and test bench for Cursor coding agents: record runs, replay and review them, and measure which model and rules work best on your repository.',
      license: 'MIT',
      type: 'module',
      bin: { avero: './avero.mjs' },
      files: ['*.mjs', 'README.md', 'LICENSE'],
      engines: { node: '>=24' },
      keywords: ['cursor', 'agent', 'coding-agent', 'benchmark', 'observability', 'mcp'],
      dependencies: { '@cursor/sdk': sdkVersion },
    },
    null,
    2,
  )}\n`,
);
copyFileSync(join(root, 'README.md'), join(out, 'README.md'));
copyFileSync(join(root, 'LICENSE'), join(out, 'LICENSE'));
console.log(`Built ${out}\nNext: cd dist-npm/avero && npm pack --dry-run`);
