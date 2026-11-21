'use strict';

/**
 * What a new shared library consists of, as data: a map from path (relative to the package) to
 * file text. No Nx here, so it is easy to read and to test.
 */

const types = ['util', 'contract', 'data-access', 'integration'];
const runtimes = ['node', 'browser'];

const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Throws a message a person can act on when an option is not usable. `existing` maps each package
 * in packages/ to its runtime (`node` or `browser`).
 */
function validate(options, existing) {
  const problems = [];
  if (!namePattern.test(options.name ?? ''))
    problems.push('The name must be lower-case words joined by dashes, such as "queue-tools".');
  if (!types.includes(options.type)) problems.push(`The type must be one of: ${types.join(', ')}.`);
  if (!runtimes.includes(options.runtime))
    problems.push(`The runtime must be one of: ${runtimes.join(', ')}.`);
  if (options.name in existing) problems.push(`packages/${options.name} already exists.`);
  if (options.runtime === 'browser' && options.type === 'data-access')
    problems.push('A data-access package talks to a database or files, so it cannot be "browser".');
  for (const dependency of options.dependencies) {
    if (dependency === options.name) problems.push('A package cannot depend on itself.');
    else if (!(dependency in existing))
      problems.push(`"${dependency}" is not a package in packages/.`);
    else if (options.runtime === 'browser' && existing[dependency] !== 'browser')
      problems.push(
        `A "browser" package cannot depend on "${dependency}", which needs Node.js. The lint rules would reject it.`,
      );
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
}

function files(options) {
  const scope = '@avero';
  const dependencies = Object.fromEntries(
    options.dependencies.map((name) => [`${scope}/${name}`, 'workspace:*']),
  );
  const packageJson = {
    name: `${scope}/${options.name}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    files: ['dist'],
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
    scripts: { build: 'tsc -p tsconfig.build.json', typecheck: 'tsc --noEmit' },
    dependencies,
    nx: {
      tags: ['scope:shared', `type:${options.type}`, `runtime:${options.runtime}`],
      targets: { build: { outputs: ['{projectRoot}/dist'] } },
    },
  };

  const compilerOptions =
    options.runtime === 'node'
      ? { rootDir: 'src', lib: ['ES2023', 'ES2025.RegExp'], types: ['node'] }
      : { rootDir: 'src' };

  const result = {
    'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
    'tsconfig.json': `${JSON.stringify(
      { extends: '../../tsconfig.base.json', compilerOptions, include: ['src/**/*.ts'] },
      null,
      2,
    )}\n`,
    'tsconfig.build.json': `${JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: { outDir: 'dist', declaration: true },
        exclude: ['src/**/*.test.ts'],
      },
      null,
      2,
    )}\n`,
    'src/index.ts': `// The public entry point of ${scope}/${options.name}. Everything other packages may use is exported here.\nexport {};\n`,
  };

  if (options.tests) {
    result['vitest.config.ts'] =
      "import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({ test: { include: ['src/**/*.test.ts'] } });\n";
    result['src/index.test.ts'] =
      "import { describe, expect, it } from 'vitest';\nimport * as entry from './index.ts';\n\n// Replace this with tests of what the package does. It only proves the package builds and loads.\ndescribe('the package entry point', () => {\n  it('loads', () => {\n    expect(entry).toBeTypeOf('object');\n  });\n});\n";
  }
  return result;
}

module.exports = { files, validate, types, runtimes };
