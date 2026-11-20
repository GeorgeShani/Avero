import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSuite,
  findCandidates,
  isSourcePath,
  isTestPath,
  NoTasksError,
  slugify,
  taskPrompt,
  validateTask,
} from './suite.ts';
import { demoHistory, makeRepo } from './testing/make-repo.ts';

const dirs: string[] = [];
afterEach(async () => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

async function demo() {
  const repo = await makeRepo(demoHistory);
  dirs.push(repo.dir);
  return repo;
}

describe('isTestPath and isSourcePath', () => {
  it('recognises common test file layouts', () => {
    for (const path of [
      'a.test.ts',
      'src/a.spec.js',
      'tests/x.js',
      'pkg/__tests__/a.js',
      'x_test.go',
      'test_x.py',
      'FooTests.java',
    ]) {
      expect(isTestPath(path), path).toBe(true);
    }
    expect(isTestPath('src/contest.ts')).toBe(false);
  });

  it('treats docs, lockfiles and workflows as not source', () => {
    for (const path of [
      'README.md',
      'pnpm-lock.yaml',
      'package-lock.json',
      '.github/workflows/ci.yml',
      'logo.svg',
    ]) {
      expect(isSourcePath(path), path).toBe(false);
    }
    expect(isSourcePath('src/a.ts')).toBe(true);
    expect(isSourcePath('a.test.ts')).toBe(false);
  });
});

describe('taskPrompt and slugify', () => {
  it('joins subject and body and drops trailers', () => {
    expect(
      taskPrompt('Add retries', 'Use backoff.\n\nCo-Authored-By: A <a@b.c>\nSigned-off-by: X'),
    ).toBe('Add retries\n\nUse backoff.');
    expect(taskPrompt('Add retries', '')).toBe('Add retries');
  });

  it('makes a short slug', () => {
    expect(slugify('Add a multiply helper!')).toBe('add-a-multiply-helper');
    expect(slugify('x'.repeat(80)).length).toBeLessThanOrEqual(40);
  });
});

describe('findCandidates', () => {
  it('finds the commits that change source and tests, newest first, and skips the rest', async () => {
    const { dir, shas } = await demo();
    const found = await findCandidates(dir);
    expect(found.map((candidate) => candidate.subject)).toEqual([
      'Add clamp(value, min, max) in clamp.js',
      'Add a multiply helper',
    ]);
    expect(found[0]?.sha).toBe(shas[3]);
    expect(found[0]?.parent).toBe(shas[2]);
  });

  it('skips a commit that is too large', async () => {
    const { dir } = await demo();
    expect(await findCandidates(dir, { maxLines: 3 })).toEqual([]);
  });
});

describe('validateTask', () => {
  it('accepts a task whose tests fail before the change and pass after it', async () => {
    const { dir } = await demo();
    const result = await buildSuite({
      repoDir: dir,
      id: 'demo',
      testCommand: 'node --test',
      count: 1,
      validate: false,
    });
    const task = result.suite.tasks[0];
    if (!task) throw new Error('no task');
    expect(await validateTask(dir, { testCommand: 'node --test' }, task)).toEqual({ ok: true });
  });

  it('rejects a task whose tests already pass at the base commit', async () => {
    const { dir } = await demo();
    const { suite } = await buildSuite({
      repoDir: dir,
      id: 'demo',
      testCommand: 'node --test',
      count: 1,
      validate: false,
    });
    const task = suite.tasks[0];
    if (!task) throw new Error('no task');
    const result = await validateTask(dir, { testCommand: 'node -e "process.exit(0)"' }, task);
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).toContain('already pass');
  });

  it('rejects a task whose tests fail even at the solution commit', async () => {
    const { dir } = await demo();
    const { suite } = await buildSuite({
      repoDir: dir,
      id: 'demo',
      testCommand: 'node --test',
      count: 1,
      validate: false,
    });
    const task = suite.tasks[0];
    if (!task) throw new Error('no task');
    const result = await validateTask(dir, { testCommand: 'node -e "process.exit(1)"' }, task);
    expect(JSON.stringify(result)).toContain('solution commit');
  });
});

describe('buildSuite', () => {
  it('builds a validated suite from history, with the test files to judge by', async () => {
    const { dir, shas } = await demo();
    const { suite, skipped } = await buildSuite({
      repoDir: dir,
      id: 'demo',
      testCommand: 'node --test',
      count: 5,
    });
    expect(suite.tasks.map((task) => task.source.subject)).toEqual([
      'Add clamp(value, min, max) in clamp.js',
      'Add a multiply helper',
    ]);
    expect(skipped).toEqual([]);
    const clamp = suite.tasks[0];
    expect(clamp?.testFiles).toEqual(['clamp.test.js']);
    expect(clamp?.baseSha).toBe(shas[2]);
    expect(clamp?.prompt).toContain('Return value limited to the range');
    expect(suite.repo.head).toBe(shas[3]);
  });

  it('keeps only as many tasks as asked for', async () => {
    const { dir } = await demo();
    const { suite } = await buildSuite({
      repoDir: dir,
      id: 'demo',
      testCommand: 'node --test',
      count: 1,
    });
    expect(suite.tasks).toHaveLength(1);
  });

  it('drops tasks whose tests do not measure them, and says why', async () => {
    const { dir } = await demo();
    await expect(
      buildSuite({ repoDir: dir, id: 'demo', testCommand: 'node -e "process.exit(0)"', count: 5 }),
    ).rejects.toThrow(NoTasksError);
  });

  it('says so when no commit looks like a task', async () => {
    const repo = await makeRepo([
      { message: 'Only docs here', files: { 'README.md': '# a\n' } },
      { message: 'More docs', files: { 'README.md': '# b\n' } },
    ]);
    dirs.push(repo.dir);
    await expect(
      buildSuite({ repoDir: repo.dir, id: 'x', testCommand: 'npm test' }),
    ).rejects.toThrow(/touches both source and tests/);
  });
});
