#!/usr/bin/env node
/**
 * Creates a small git repository with a real history, to try `avero bench` on without risking a
 * real project. Each feature commit adds a function and its test, so each one becomes a bench task.
 *
 *   node tools/scripts/make-demo-repo.mjs [directory]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const target = process.argv[2]
  ? resolve(process.argv[2])
  : mkdtempSync(join(tmpdir(), 'avero-demo-'));
mkdirSync(target, { recursive: true });
if (readdirSync(target).length > 0) {
  console.error(`${target} is not empty. Pass an empty or new directory.`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: target, stdio: 'pipe' }).toString();
git('init', '-q');
git('config', 'user.name', 'Avero Demo');
git('config', 'user.email', 'demo@example.com');
git('config', 'core.autocrlf', 'false');

const testFile = (name, imports, body) =>
  `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { ${imports} } from './${name}.js';\n\n${body}`;

const commits = [
  {
    message: 'Start the project',
    files: {
      'package.json': JSON.stringify(
        { name: 'avero-demo', private: true, type: 'module', scripts: { test: 'node --test' } },
        null,
        2,
      ),
      '.gitignore': 'node_modules\n.avero\n',
      'README.md': '# Avero demo\n\nSmall helpers with tests. Run `npm test`.\n',
    },
  },
  {
    message:
      'Add slugify(text) in slugify.js\n\nLowercase the text, replace runs of non-alphanumerics with one dash, and trim dashes.',
    files: {
      'slugify.js':
        "export const slugify = (text) =>\n  text\n    .toLowerCase()\n    .replace(/[^a-z0-9]+/g, '-')\n    .replace(/^-+|-+$/g, '');\n",
      'slugify.test.js': testFile(
        'slugify',
        'slugify',
        "test('slugifies', () => {\n  assert.equal(slugify('Hello, World!'), 'hello-world');\n  assert.equal(slugify('  --A  b--  '), 'a-b');\n  assert.equal(slugify('***'), '');\n});\n",
      ),
    },
  },
  {
    message:
      'Add clamp(value, min, max) in clamp.js\n\nReturn value limited to the range min..max.',
    files: {
      'clamp.js':
        'export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);\n',
      'clamp.test.js': testFile(
        'clamp',
        'clamp',
        "test('clamps', () => {\n  assert.equal(clamp(15, 0, 10), 10);\n  assert.equal(clamp(-5, 0, 10), 0);\n  assert.equal(clamp(5, 0, 10), 5);\n});\n",
      ),
    },
  },
  {
    message:
      'Add chunk(list, size) in chunk.js\n\nSplit an array into arrays of at most size items. Throw a RangeError when size is not a whole number of at least 1.',
    files: {
      'chunk.js':
        "export function chunk(list, size) {\n  if (!Number.isInteger(size) || size < 1) throw new RangeError('size must be a whole number of at least 1');\n  const out = [];\n  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));\n  return out;\n}\n",
      'chunk.test.js': testFile(
        'chunk',
        'chunk',
        "test('chunks', () => {\n  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);\n  assert.deepEqual(chunk([], 3), []);\n});\n\ntest('rejects a bad size', () => {\n  assert.throws(() => chunk([1], 0), RangeError);\n  assert.throws(() => chunk([1], 1.5), RangeError);\n});\n",
      ),
    },
  },
  {
    message:
      'Add truncate(text, max) in truncate.js\n\nCut text longer than max characters and end it with an ellipsis (...), keeping the result at most max characters long. Shorter text is returned unchanged.',
    files: {
      'truncate.js':
        'export const truncate = (text, max) =>\n  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 3))}...`;\n',
      'truncate.test.js': testFile(
        'truncate',
        'truncate',
        "test('truncates', () => {\n  assert.equal(truncate('hello world', 8), 'hello...');\n  assert.equal(truncate('short', 8), 'short');\n  assert.equal(truncate('exact', 5), 'exact');\n});\n",
      ),
    },
  },
  {
    message:
      'Add countWords(text) in words.js\n\nCount the words in a text. Words are separated by any whitespace; an empty or blank text has none.',
    files: {
      'words.js':
        'export const countWords = (text) => text.split(/\\s+/).filter(Boolean).length;\n',
      'words.test.js': testFile(
        'words',
        'countWords',
        "test('counts words', () => {\n  assert.equal(countWords('one two  three'), 3);\n  assert.equal(countWords('  \\n\\t '), 0);\n  assert.equal(countWords('single'), 1);\n});\n",
      ),
    },
  },
];

for (const commit of commits) {
  for (const [path, content] of Object.entries(commit.files)) {
    const file = join(target, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', commit.message);
}

console.log(`Demo repository: ${target}\n${commits.length} commits.\n`);
console.log(`Try it:\n  pnpm avero bench init --repo "${target}" --test "npm test"`);
