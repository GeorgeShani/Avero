import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git.ts';

/**
 * Checks a commit out into a throwaway folder (a git worktree, so the repository's own checkout is
 * never touched), runs `work` in it, and always removes it afterwards.
 */
export async function withWorktree<T>(
  repoDir: string,
  sha: string,
  work: (dir: string) => Promise<T>,
): Promise<T> {
  const parent = await mkdtemp(join(tmpdir(), 'avero-bench-'));
  const dir = join(parent, 'work');
  await git(repoDir, ['worktree', 'add', '--detach', '--force', dir, sha]);
  try {
    return await work(dir);
  } finally {
    await git(repoDir, ['worktree', 'remove', '--force', dir]).catch(() => undefined);
    await git(repoDir, ['worktree', 'prune']).catch(() => undefined);
    await rm(parent, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Commits everything in a worktree, so later changes show up as the agent's alone. */
export async function commitAll(dir: string, message: string): Promise<void> {
  await git(dir, ['add', '-A']);
  const status = await git(dir, ['status', '--porcelain']);
  if (status.trim() === '') return;
  await git(dir, [
    '-c',
    'user.name=Avero bench',
    '-c',
    'user.email=bench@avero.invalid',
    'commit',
    '-q',
    '--no-verify',
    '-m',
    message,
  ]);
}
