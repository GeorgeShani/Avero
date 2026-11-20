import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { git } from '../git.ts';

export type CommitSpec = {
  message: string;
  /** Files to write in this commit. */
  files: Record<string, string>;
};

/** Creates a git repository in a temp folder with the given history, oldest commit first. */
export async function makeRepo(commits: CommitSpec[]): Promise<{ dir: string; shas: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'avero-bench-test-'));
  await git(dir, ['init', '-q']);
  await git(dir, ['config', 'user.name', 'Test']);
  await git(dir, ['config', 'user.email', 'test@example.com']);
  await git(dir, ['config', 'core.autocrlf', 'false']);
  const shas: string[] = [];
  for (const commit of commits) {
    for (const [path, content] of Object.entries(commit.files)) {
      const target = join(dir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    await git(dir, ['add', '-A']);
    await git(dir, ['commit', '-q', '--no-verify', '-m', commit.message]);
    shas.push((await git(dir, ['rev-parse', 'HEAD'])).trim());
  }
  return { dir, shas };
}

const pkg = JSON.stringify({ name: 'demo', type: 'module', scripts: { test: 'node --test' } });

/**
 * A small project with a history of four commits: a start, a feature with its test, a docs change
 * (not a task), and a second feature in new files with its own test.
 */
export const demoHistory: CommitSpec[] = [
  {
    message: 'Start the project',
    files: {
      'package.json': pkg,
      'math.js': 'export const add = (a, b) => a + b;\n',
      'math.test.js':
        "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { add } from './math.js';\ntest('adds', () => assert.equal(add(1, 2), 3));\n",
    },
  },
  {
    message:
      'Add a multiply helper\n\nmath.js should export multiply(a, b) that returns the product.',
    files: {
      'math.js': 'export const add = (a, b) => a + b;\nexport const multiply = (a, b) => a * b;\n',
      'math.test.js':
        "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { add, multiply } from './math.js';\ntest('adds', () => assert.equal(add(1, 2), 3));\ntest('multiplies', () => assert.equal(multiply(3, 4), 12));\n",
    },
  },
  { message: 'Write the readme', files: { 'README.md': '# demo\n' } },
  {
    message:
      'Add clamp(value, min, max) in clamp.js\n\nReturn value limited to the range min..max.',
    files: {
      'clamp.js':
        'export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);\n',
      'clamp.test.js':
        "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { clamp } from './clamp.js';\ntest('clamps', () => {\n  assert.equal(clamp(15, 0, 10), 10);\n  assert.equal(clamp(-5, 0, 10), 0);\n  assert.equal(clamp(5, 0, 10), 5);\n});\n",
    },
  },
];
