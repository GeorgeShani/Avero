import { basename } from 'node:path';
import { benchSuiteSchema, type BenchSuite, type BenchTask } from '@avero/contracts';
import { git, shell } from './git.ts';
import { withWorktree } from './worktree.ts';

const testPatterns = [
  /(^|\/)(tests?|__tests__|specs?)\//i,
  /\.(test|spec)\.[a-z0-9]+$/i,
  /_test\.(go|py|rb)$/i,
  /(^|\/)test_[^/]+\.py$/i,
  /Tests?\.(java|kt|cs|swift)$/,
];

const notSource =
  /\.(md|mdx|txt|lock|svg|png|jpe?g|gif|ico)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|^\.github\//i;

export function isTestPath(path: string): boolean {
  return testPatterns.some((pattern) => pattern.test(path));
}

/** A file that holds the behaviour being changed: not a test, not docs, not a lockfile. */
export function isSourcePath(path: string): boolean {
  return !isTestPath(path) && !notSource.test(path);
}

export type Candidate = {
  sha: string;
  parent: string;
  subject: string;
  body: string;
  files: string[];
  changedLines: number;
};

const skippedSubjects = /^(merge|revert|bump|chore\(deps|release|version)/i;

/** The commit message as a task: subject and body, without trailers like Co-authored-by. */
export function taskPrompt(subject: string, body: string): string {
  const kept = body
    .split(/\r?\n/)
    .filter((line) => !/^(co-authored-by|signed-off-by|change-id|reviewed-by):/i.test(line.trim()))
    .join('\n')
    .trim();
  return kept ? `${subject.trim()}\n\n${kept}` : subject.trim();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/**
 * Commits, newest first, that look like a task with a test: one parent, a small change, and both a
 * source file and a test file touched. A commit that only touches tests or only docs is not a task.
 */
export async function findCandidates(
  repoDir: string,
  options: { scan?: number; maxLines?: number; maxFiles?: number } = {},
): Promise<Candidate[]> {
  const { scan = 200, maxLines = 400, maxFiles = 10 } = options;
  const log = await git(repoDir, [
    'log',
    '--no-merges',
    '--first-parent',
    `-n${scan}`,
    '--format=%H%x1f%P%x1f%s%x1f%b%x1e',
  ]);

  const candidates: Candidate[] = [];
  for (const record of log.split('\x1e')) {
    const [sha, parents, subject, body] = record.replace(/^\s+/, '').split('\x1f');
    if (!sha || !parents || subject === undefined) continue;
    const parentList = parents.split(' ').filter(Boolean);
    if (parentList.length !== 1 || !parentList[0] || skippedSubjects.test(subject)) continue;

    const numstat = await git(repoDir, [
      'diff-tree',
      '--no-commit-id',
      '--numstat',
      '--no-renames',
      '-r',
      sha,
    ]);
    const files: string[] = [];
    let changedLines = 0;
    for (const line of numstat.split('\n')) {
      const [added, removed, ...rest] = line.split('\t');
      const path = rest.join('\t');
      if (!path) continue;
      files.push(path);
      changedLines += (Number(added) || 0) + (Number(removed) || 0);
    }
    if (files.length === 0 || files.length > maxFiles || changedLines > maxLines) continue;
    if (!files.some(isTestPath) || !files.some(isSourcePath)) continue;
    candidates.push({
      sha,
      parent: parentList[0],
      subject: subject.trim(),
      body: (body ?? '').trim(),
      files,
      changedLines,
    });
  }
  return candidates;
}

async function existsAt(repoDir: string, sha: string, path: string): Promise<boolean> {
  try {
    await git(repoDir, ['cat-file', '-e', `${sha}:${path}`]);
    return true;
  } catch {
    return false;
  }
}

export async function taskFromCandidate(
  repoDir: string,
  candidate: Candidate,
): Promise<BenchTask | undefined> {
  const testFiles: string[] = [];
  for (const path of candidate.files.filter(isTestPath)) {
    if (await existsAt(repoDir, candidate.sha, path)) testFiles.push(path);
  }
  const prompt = taskPrompt(candidate.subject, candidate.body);
  if (testFiles.length === 0 || prompt.length < 15) return undefined;
  return {
    id: `${slugify(candidate.subject) || 'task'}-${candidate.sha.slice(0, 7)}`,
    title: candidate.subject.slice(0, 200),
    prompt,
    baseSha: candidate.parent,
    solutionSha: candidate.sha,
    testFiles,
    source: { kind: 'commit', subject: candidate.subject.slice(0, 300) },
  };
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * A task only measures something if its tests fail without the change and pass with it. This runs
 * the test command at the solution commit (it must pass) and at the base commit with the solution's
 * test files put in (it must fail).
 */
export async function validateTask(
  repoDir: string,
  commands: { testCommand: string; setupCommand?: string },
  task: BenchTask,
  timeoutMs = 300_000,
): Promise<ValidationResult> {
  const setup = async (dir: string): Promise<string | undefined> => {
    if (!commands.setupCommand) return undefined;
    const done = await shell(dir, commands.setupCommand, timeoutMs);
    return done.exitCode === 0
      ? undefined
      : `The setup command failed (${done.exitCode ?? 'no exit code'}).`;
  };

  const atSolution = await withWorktree(repoDir, task.solutionSha, async (dir) => {
    const failedSetup = await setup(dir);
    if (failedSetup) return failedSetup;
    const run = await shell(dir, commands.testCommand, timeoutMs);
    if (run.exitCode === 0) return undefined;
    return run.timedOut
      ? 'The tests timed out at the solution commit.'
      : `The tests fail at the solution commit itself (exit ${run.exitCode ?? 'none'}).`;
  });
  if (atSolution) return { ok: false, reason: atSolution };

  const atBase = await withWorktree(repoDir, task.baseSha, async (dir) => {
    const failedSetup = await setup(dir);
    if (failedSetup) return failedSetup;
    await git(dir, ['checkout', task.solutionSha, '--', ...task.testFiles]);
    const run = await shell(dir, commands.testCommand, timeoutMs);
    if (run.exitCode !== 0 && !run.timedOut && run.exitCode !== null) return undefined;
    return run.timedOut
      ? 'The tests timed out at the base commit.'
      : 'The tests already pass before the change, so they do not measure this task.';
  });
  return atBase ? { ok: false, reason: atBase } : { ok: true };
}

export class NoTasksError extends Error {
  readonly skipped: { sha: string; subject: string; reason: string }[];
  constructor(message: string, skipped: { sha: string; subject: string; reason: string }[]) {
    super(message);
    this.name = 'NoTasksError';
    this.skipped = skipped;
  }
}

export type BuildSuiteOptions = {
  repoDir: string;
  id: string;
  testCommand: string;
  setupCommand?: string;
  /** How many tasks to keep. */
  count?: number;
  /** How many recent commits to look through. */
  scan?: number;
  maxLines?: number;
  maxFiles?: number;
  /** Check each task's tests discriminate. On by default; turn off only to skip the test runs. */
  validate?: boolean;
  timeoutMs?: number;
  now?: () => Date;
  onProgress?: (message: string) => void;
};

/** Builds a bench suite from the repository's own history. */
export async function buildSuite(
  options: BuildSuiteOptions,
): Promise<{ suite: BenchSuite; skipped: { sha: string; subject: string; reason: string }[] }> {
  const { repoDir, count = 5, validate = true } = options;
  const say = options.onProgress ?? (() => undefined);
  const head = (await git(repoDir, ['rev-parse', 'HEAD'])).trim();

  say('Looking through recent commits…');
  const candidates = await findCandidates(repoDir, {
    ...(options.scan !== undefined ? { scan: options.scan } : {}),
    ...(options.maxLines !== undefined ? { maxLines: options.maxLines } : {}),
    ...(options.maxFiles !== undefined ? { maxFiles: options.maxFiles } : {}),
  });
  say(`${candidates.length} commit(s) look like a task with a test.`);

  const tasks: BenchTask[] = [];
  const skipped: { sha: string; subject: string; reason: string }[] = [];
  for (const candidate of candidates) {
    if (tasks.length >= count) break;
    const task = await taskFromCandidate(repoDir, candidate);
    if (!task) {
      skipped.push({
        sha: candidate.sha,
        subject: candidate.subject,
        reason: 'The message is too short to be a task, or its tests were deleted.',
      });
      continue;
    }
    if (validate) {
      say(`Checking that the tests measure "${task.title}"…`);
      const checked = await validateTask(
        repoDir,
        {
          testCommand: options.testCommand,
          ...(options.setupCommand ? { setupCommand: options.setupCommand } : {}),
        },
        task,
        options.timeoutMs,
      );
      if (!checked.ok) {
        skipped.push({ sha: candidate.sha, subject: candidate.subject, reason: checked.reason });
        continue;
      }
    }
    tasks.push(task);
  }

  if (tasks.length === 0) {
    throw new NoTasksError(
      candidates.length === 0
        ? 'No commit in the recent history touches both source and tests.'
        : `None of the ${candidates.length} candidate commits made a usable task. First reason: ${skipped[0]?.reason ?? 'unknown'}`,
      skipped,
    );
  }

  const suite = benchSuiteSchema.parse({
    v: 1,
    id: options.id,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    repo: { name: basename(repoDir), head },
    testCommand: options.testCommand,
    ...(options.setupCommand ? { setupCommand: options.setupCommand } : {}),
    tasks,
  });
  return { suite, skipped };
}
