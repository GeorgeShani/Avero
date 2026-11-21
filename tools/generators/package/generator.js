'use strict';

const { formatFiles, joinPathFragments, logger } = require('@nx/devkit');
const { files, validate } = require('./files.js');

/** Every package in packages/ with its runtime, read from the tags in its package.json. */
function existingPackages(tree) {
  const result = {};
  for (const name of tree.children('packages')) {
    const manifest = joinPathFragments('packages', name, 'package.json');
    if (!tree.exists(manifest)) continue;
    const tags = JSON.parse(tree.read(manifest, 'utf-8')).nx?.tags ?? [];
    result[name] = tags.includes('runtime:browser') ? 'browser' : 'node';
  }
  return result;
}

/** Creates packages/<name> as a shared library with the workspace's tags and TypeScript setup. */
async function packageGenerator(tree, raw) {
  const options = {
    name: raw.name,
    type: raw.type ?? 'util',
    runtime: raw.runtime ?? 'node',
    tests: raw.tests ?? true,
    dependencies: String(raw.dependencies ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
  validate(options, existingPackages(tree));

  for (const [path, content] of Object.entries(files(options))) {
    tree.write(joinPathFragments('packages', options.name, path), content);
  }
  await formatFiles(tree);

  return () => {
    logger.info(
      [
        `Created packages/${options.name} as @avero/${options.name}.`,
        'Next: run `pnpm install` to link it, then `pnpm exec nx run-many -t typecheck lint test build -p @avero/' +
          options.name +
          '`.',
        'To use it from another package, add `"@avero/' +
          options.name +
          '": "workspace:*"` to that package\'s dependencies.',
      ].join('\n'),
    );
  };
}

module.exports = packageGenerator;
module.exports.default = packageGenerator;
