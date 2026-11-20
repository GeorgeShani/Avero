import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ChangedFile, Changes } from '@avero/contracts';

const run = promisify(execFile);

/** The hash of git's empty tree: what a repository with no commits is compared against. */
const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const maxPatchChars = 200_000;

/** Avero's own records live in .avero/, so they are never counted as the agent's changes. */
const notAvero = ['--', '.', ':(exclude).avero'];
const maxCountedFileBytes = 1_000_000;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-c', 'core.quotepath=off', ...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30_000,
  });
  return stdout;
}

export type GitState = { head?: string; dirtyBefore: boolean };

/** Where the repository stands before a run, or undefined when the folder is not a git repo. */
export async function gitState(cwd: string): Promise<GitState | undefined> {
  try {
    await git(cwd, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    return undefined;
  }
  const head = await git(cwd, ['rev-parse', 'HEAD']).then(
    (out) => out.trim(),
    () => undefined,
  );
  const status = await git(cwd, ['status', '--porcelain', ...notAvero]).catch(() => '');
  return { ...(head ? { head } : {}), dirtyBefore: status.trim() !== '' };
}

const statusByLetter: Record<string, ChangedFile['status']> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  T: 'modified',
  C: 'added',
};

async function countLines(path: string): Promise<number | null> {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > maxCountedFileBytes) return null;
    const buffer = await readFile(path);
    if (buffer.includes(0)) return null;
    const text = buffer.toString('utf8');
    if (text === '') return 0;
    return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  } catch {
    return null;
  }
}

/** A new-file diff for one file git does not track. `git diff --no-index` exits 1 when files differ. */
async function newFilePatch(cwd: string, path: string): Promise<string> {
  try {
    return await git(cwd, ['diff', '--no-index', '--', '/dev/null', path]);
  } catch (error) {
    const stdout = (error as { stdout?: unknown }).stdout;
    return typeof stdout === 'string' ? stdout : '';
  }
}

/** What changed in the working tree since HEAD: tracked edits, plus files git does not track yet. */
export async function collectChanges(cwd: string): Promise<Changes | undefined> {
  if (!(await gitState(cwd))) return undefined;
  const base = await git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']).then(
    () => 'HEAD',
    () => emptyTree,
  );

  const [nameStatus, numstat, patch, untracked] = await Promise.all([
    git(cwd, ['diff', base, '--name-status', '-M', ...notAvero]),
    git(cwd, ['diff', base, '--numstat', '-M', ...notAvero]),
    git(cwd, ['diff', base, '-M', ...notAvero]),
    git(cwd, ['ls-files', '--others', '--exclude-standard', ...notAvero]),
  ]);

  const counts = new Map<string, { additions: number | null; deletions: number | null }>();
  for (const line of numstat.split('\n')) {
    const [add, del, ...rest] = line.split('\t');
    const path = rest.join('\t');
    if (!path) continue;
    counts.set(path, {
      additions: add === '-' ? null : Number(add),
      deletions: del === '-' ? null : Number(del),
    });
  }

  const files: ChangedFile[] = [];
  for (const line of nameStatus.split('\n')) {
    const [letters, ...paths] = line.split('\t');
    if (!letters || paths.length === 0) continue;
    // A rename lists the old path then the new one; numstat shows "old => new", so look up either.
    const path = paths.at(-1) ?? '';
    const counted = counts.get(path) ??
      counts.get(paths.join(' => ')) ?? { additions: null, deletions: null };
    files.push({
      path,
      status: statusByLetter[letters.charAt(0)] ?? 'modified',
      ...counted,
    });
  }

  for (const path of untracked.split('\n').filter(Boolean)) {
    files.push({
      path,
      status: 'untracked',
      additions: await countLines(join(cwd, path)),
      deletions: 0,
    });
  }

  // `git diff` leaves out files git does not track yet, so their content is added as new-file diffs.
  let fullPatch = patch;
  for (const file of files.filter((entry) => entry.status === 'untracked')) {
    if (fullPatch.length > maxPatchChars) break;
    if (file.additions === null) continue;
    fullPatch += await newFilePatch(cwd, file.path);
  }

  const additions = files.reduce((sum, file) => sum + (file.additions ?? 0), 0);
  const deletions = files.reduce((sum, file) => sum + (file.deletions ?? 0), 0);
  const truncated = fullPatch.length > maxPatchChars;
  return {
    files,
    additions,
    deletions,
    ...(fullPatch ? { patch: truncated ? fullPatch.slice(0, maxPatchChars) : fullPatch } : {}),
    ...(truncated ? { patchTruncated: true } : {}),
  };
}
