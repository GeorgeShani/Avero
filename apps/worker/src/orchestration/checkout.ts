import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { withWorktree } from '@avero/bench';
import type { ClaimedTask, RepositoryAccess } from '@avero/db';
import { pathWithinRoots } from '@avero/security';

const run = promisify(execFile);

/** What the worker needs from GitHub: a way to clone, and a way to answer on a pull request. */
export type GithubAccess = {
  /** A token for the installation, valid for about an hour. */
  token(installationId: number): Promise<string>;
  /** Where git clones `owner/name` from. Tests point it at a local folder. */
  remoteUrl?(fullName: string): string;
  comment(token: string, fullName: string, number: number, markdown: string): Promise<void>;
};

export class CheckoutRefused extends Error {}

async function realOrResolved(path: string): Promise<string> {
  return realpath(path).catch(() => resolve(path));
}

async function git(cwd: string, args: string[], token?: string): Promise<void> {
  // The token goes in a header for this one command. It is never put in the URL or in the clone's
  // config, so the agent, which can read the working copy, cannot find it there.
  const auth = token
    ? [
        '-c',
        `http.https://github.com/.extraheader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
      ]
    : [];
  await run('git', [...auth, ...args], { cwd, timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Gives `work` a fresh working copy of the repository a task is about, and removes it afterwards.
 * A local repository must be inside the folders the worker may use and is checked out as a git
 * worktree, so it is never touched. A GitHub repository is cloned with the installation's token
 * and checked out at the pull request's commit when the task came from one.
 */
export async function withCheckout<T>(
  access: RepositoryAccess,
  task: ClaimedTask,
  deps: { roots: readonly string[]; github?: GithubAccess | undefined },
  work: (dir: string, token?: string) => Promise<T>,
): Promise<T> {
  if (access.kind === 'local') {
    const real = await realOrResolved(access.path);
    const roots = await Promise.all(deps.roots.map(realOrResolved));
    if (!pathWithinRoots(real, roots))
      throw new CheckoutRefused('The repository is outside the folders this worker may use.');
    return withWorktree(real, 'HEAD', (dir) => work(dir));
  }

  if (!deps.github) throw new CheckoutRefused('This worker is not set up to reach GitHub.');
  const token = await deps.github.token(access.installationId);
  const parent = await mkdtemp(join(tmpdir(), 'avero-clone-'));
  const dir = join(parent, 'work');
  try {
    const url =
      deps.github.remoteUrl?.(access.fullName) ?? `https://github.com/${access.fullName}.git`;
    await git(parent, ['clone', '--quiet', url, dir], token);
    const sha = task.source?.headSha;
    if (sha) {
      try {
        await git(dir, ['checkout', '--quiet', '--detach', sha]);
      } catch {
        // A pull request from a fork: its commit is not on any branch of this repository.
        await git(dir, ['fetch', '--quiet', 'origin', `pull/${task.source?.number}/head`], token);
        await git(dir, ['checkout', '--quiet', '--detach', sha]);
      }
    }
    return await work(dir, token);
  } finally {
    await rm(parent, { recursive: true, force: true }).catch(() => undefined);
  }
}
