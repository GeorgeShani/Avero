import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectChanges, gitState } from './git-changes.ts';

let dir: string;
const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd: dir,
    stdio: 'pipe',
  });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-git-'));
  git('init', '--quiet');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('gitState', () => {
  it('is undefined outside a git repository', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'avero-plain-'));
    try {
      expect(await gitState(plain)).toBeUndefined();
    } finally {
      await rm(plain, { recursive: true, force: true });
    }
  });

  it('reports a clean tree, then a dirty one', async () => {
    await writeFile(join(dir, 'a.txt'), 'one\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'init');
    const clean = await gitState(dir);
    expect(clean?.dirtyBefore).toBe(false);
    expect(clean?.head).toMatch(/^[0-9a-f]{40}$/);
    await writeFile(join(dir, 'a.txt'), 'two\n');
    expect((await gitState(dir))?.dirtyBefore).toBe(true);
  });
});

describe('collectChanges', () => {
  it('counts edits, deletions and new files since HEAD', async () => {
    await writeFile(join(dir, 'edit.txt'), 'a\nb\nc\n');
    await writeFile(join(dir, 'gone.txt'), 'x\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'init');

    await writeFile(join(dir, 'edit.txt'), 'a\nB\nc\nd\n');
    await unlink(join(dir, 'gone.txt'));
    await writeFile(join(dir, 'new.txt'), '1\n2\n');

    const changes = await collectChanges(dir);
    const byPath = Object.fromEntries((changes?.files ?? []).map((file) => [file.path, file]));
    expect(byPath['edit.txt']).toMatchObject({ status: 'modified', additions: 2, deletions: 1 });
    expect(byPath['gone.txt']).toMatchObject({ status: 'deleted', additions: 0, deletions: 1 });
    expect(byPath['new.txt']).toMatchObject({ status: 'untracked', additions: 2, deletions: 0 });
    expect(changes?.additions).toBe(4);
    expect(changes?.deletions).toBe(2);
    expect(changes?.patch).toContain('+B');
    expect(changes?.patch).toContain('+++ b/new.txt');
    expect(changes?.patch).toContain('+2');
  });

  it('works in a repository with no commits yet', async () => {
    await writeFile(join(dir, 'first.txt'), 'hello\n');
    const changes = await collectChanges(dir);
    expect(changes?.files).toEqual([
      { path: 'first.txt', status: 'untracked', additions: 1, deletions: 0 },
    ]);
  });

  it("does not count Avero's own .avero folder as the agent's work", async () => {
    await writeFile(join(dir, 'a.txt'), 'one\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'init');
    await mkdir(join(dir, '.avero', 'runs'), { recursive: true });
    await writeFile(join(dir, '.avero', 'runs', 'run-1.jsonl'), '{}\n');
    expect((await gitState(dir))?.dirtyBefore).toBe(false);
    expect((await collectChanges(dir))?.files).toEqual([]);
  });

  it('is undefined for a folder that is not a repository', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'avero-plain-'));
    try {
      expect(await collectChanges(plain)).toBeUndefined();
    } finally {
      await rm(plain, { recursive: true, force: true });
    }
  });
});
