import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const generate = require('./generator.js');

const manifest = (tree, name) => JSON.parse(tree.read(`packages/${name}/package.json`, 'utf-8'));

let tree;
beforeEach(() => {
  tree = createTreeWithEmptyWorkspace();
  // Two existing packages, like the real workspace: one Node-only, one safe for browsers.
  tree.write(
    'packages/security/package.json',
    JSON.stringify({ name: '@avero/security', nx: { tags: ['runtime:node'] } }),
  );
  tree.write(
    'packages/contracts/package.json',
    JSON.stringify({ name: '@avero/contracts', nx: { tags: ['runtime:browser'] } }),
  );
});

describe('the package generator', () => {
  it('creates a library with the workspace tags, entry point, TypeScript setup and a test', async () => {
    await generate(tree, { name: 'queue-tools', type: 'integration', dependencies: 'contracts' });

    const json = manifest(tree, 'queue-tools');
    expect(json).toMatchObject({
      name: '@avero/queue-tools',
      private: true,
      type: 'module',
      exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
      dependencies: { '@avero/contracts': 'workspace:*' },
      nx: {
        tags: ['scope:shared', 'type:integration', 'runtime:node'],
        targets: { build: { outputs: ['{projectRoot}/dist'] } },
      },
    });
    for (const file of [
      'tsconfig.json',
      'tsconfig.build.json',
      'vitest.config.ts',
      'src/index.ts',
      'src/index.test.ts',
    ])
      expect(tree.exists(`packages/queue-tools/${file}`), file).toBe(true);
    const tsconfig = JSON.parse(tree.read('packages/queue-tools/tsconfig.json', 'utf-8'));
    expect(tsconfig.compilerOptions.types).toEqual(['node']);
  });

  it('makes a browser library without Node types, and without tests when asked', async () => {
    await generate(tree, { name: 'format', runtime: 'browser', tests: false });
    expect(manifest(tree, 'format').nx.tags).toEqual([
      'scope:shared',
      'type:util',
      'runtime:browser',
    ]);
    const tsconfig = JSON.parse(tree.read('packages/format/tsconfig.json', 'utf-8'));
    expect(tsconfig.compilerOptions.types).toBeUndefined();
    expect(tree.exists('packages/format/vitest.config.ts')).toBe(false);
    expect(tree.exists('packages/format/src/index.test.ts')).toBe(false);
  });

  it('refuses a bad name, an existing package, an unknown dependency and an unsafe mix', async () => {
    await expect(generate(tree, { name: 'Bad_Name' })).rejects.toThrow('lower-case');
    await expect(generate(tree, { name: 'security' })).rejects.toThrow('already exists');
    await expect(generate(tree, { name: 'x', dependencies: 'nothing' })).rejects.toThrow(
      'not a package',
    );
    await expect(generate(tree, { name: 'x', type: 'weird' })).rejects.toThrow('type must be');
    await expect(
      generate(tree, { name: 'x', runtime: 'browser', dependencies: 'security' }),
    ).rejects.toThrow('needs Node.js');
    await expect(
      generate(tree, { name: 'x', runtime: 'browser', type: 'data-access' }),
    ).rejects.toThrow('cannot be "browser"');
    expect(tree.exists('packages/x')).toBe(false);
  });

  it('reports every problem at once', async () => {
    await expect(generate(tree, { name: 'Bad', type: 'weird' })).rejects.toThrow(
      /lower-case[\s\S]*type must be/,
    );
  });
});
