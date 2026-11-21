import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AgentLike, AgentRunLike, CreateAgent } from '@avero/coding-engine';
import {
  addLocalRepository,
  connectDatabase,
  createTask,
  createWorkspace,
  type AveroDatabase,
} from '@avero/db';

const run = promisify(execFile);

/** A temp folder that holds git repositories, standing in for the roots a worker may use. */
export async function makeRoot(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'avero-worker-root-')));
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

export async function makeGitRepo(root: string, name: string): Promise<string> {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  const git = (...args: string[]) => run('git', args, { cwd: dir });
  await git('init', '-q');
  await git('config', 'user.name', 'Test');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'core.autocrlf', 'false');
  await writeFile(join(dir, 'README.md'), '# demo\n');
  await git('add', '-A');
  await git('commit', '-q', '--no-verify', '-m', 'Start');
  return dir;
}

export async function worktreeCount(repo: string): Promise<number> {
  const { stdout } = await run('git', ['worktree', 'list', '--porcelain'], { cwd: repo });
  return stdout.split('\n').filter((line) => line.startsWith('worktree ')).length;
}

const ids = { agent_id: 'a', run_id: 'r' };
const usage = (total: number) => ({
  inputTokens: total,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: total,
});
const say = (text: string) =>
  ({
    type: 'assistant',
    ...ids,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  }) as never;

export type FakeBehaviour = {
  /** Files the "agent" writes into its working folder, by relative path. */
  writes?: Record<string, string>;
  /** Wait this long at the start, so a test can act while the task is running. */
  holdMs?: number;
  /** Keep going until cancelled (a long run). */
  untilCancelled?: boolean;
  fail?: string;
  /** Called with the working folder when the agent is created, to look inside it. */
  onCreate?: (cwd: string) => void | Promise<void>;
};

/** A stand-in for the Cursor SDK that edits files and answers, so the worker can be tested whole. */
export function fakeAgent(behaviour: FakeBehaviour = {}) {
  const seen = {
    created: 0,
    cwds: [] as string[],
    cancels: 0,
    settingSources: [] as (readonly string[] | undefined)[],
    guardInstalled: [] as boolean[],
  };
  const createAgent: CreateAgent = async (options) => {
    seen.created += 1;
    const local = (options as { local?: { cwd?: string; settingSources?: readonly string[] } })
      .local;
    const cwd = local?.cwd ?? '';
    seen.cwds.push(cwd);
    seen.settingSources.push(local?.settingSources);
    seen.guardInstalled.push(existsSync(join(cwd, '.cursor', 'hooks', 'avero-guard.mjs')));
    await behaviour.onCreate?.(cwd);
    const agent: AgentLike = {
      send: async () => {
        let cancelled = false;
        const agentRun: AgentRunLike = {
          stream: async function* () {
            yield say('Looking at the repository.');
            for (const [path, content] of Object.entries(behaviour.writes ?? {})) {
              await mkdir(join(cwd, path, '..'), { recursive: true });
              await writeFile(join(cwd, path), content);
            }
            if (behaviour.holdMs) await new Promise((r) => setTimeout(r, behaviour.holdMs));
            while (behaviour.untilCancelled && !cancelled) {
              await new Promise((r) => setTimeout(r, 25));
            }
            if (cancelled) return;
            yield say('Done.');
          },
          wait: async () =>
            behaviour.fail
              ? { status: 'error' as const, error: { message: behaviour.fail }, usage: usage(5) }
              : cancelled
                ? { status: 'cancelled' as const, usage: usage(0) }
                : { status: 'finished' as const, result: 'Finished the task.', usage: usage(42) },
          cancel: async () => {
            cancelled = true;
            seen.cancels += 1;
          },
        };
        return agentRun;
      },
      getUsage: async () => {
        throw new Error('not available');
      },
      [Symbol.asyncDispose]: async () => undefined,
    };
    return agent;
  };
  return { createAgent, seen };
}

/** A workspace, a registered repository and a task, in a real database. */
export async function seedTask(
  db: AveroDatabase,
  options: { repoPath: string; prompt?: string; clerkUserId: string; review?: boolean },
) {
  const workspace = await createWorkspace(
    db,
    { clerkUserId: options.clerkUserId, email: null },
    `Worker ${randomUUID().slice(0, 8)}`,
  );
  const repository = await addLocalRepository(db, workspace.id, {
    name: 'demo',
    path: options.repoPath,
  });
  const task = await createTask(
    db,
    workspace.id,
    {
      repositoryId: repository.id,
      prompt: options.prompt ?? 'Add a note file',
      ...(options.review ? { review: true } : {}),
    },
    { defaultModel: 'composer-2.5' },
  );
  return { workspace, repository, task };
}

/** Removes everything a test created for these identities: their workspaces (and so everything in them) and then the users. */
export async function purgeTestData(
  db: AveroDatabase,
  clerkUserIds: readonly string[],
): Promise<void> {
  if (clerkUserIds.length === 0) return;
  const ids = sql.join(
    clerkUserIds.map((id) => sql`${id}`),
    sql`, `,
  );
  await db.execute(
    sql`delete from workspaces where owner_id in (select id from users where clerk_user_id in (${ids}))`,
  );
  await db.execute(sql`delete from users where clerk_user_id in (${ids})`);
}

export { connectDatabase };

/** A repository with a base commit and a pull-request commit, cloned bare to stand in for GitHub. */
export async function makeRemote(root: string, name: string) {
  const work = await makeGitRepo(root, `${name}-work`);
  const git = (...args: string[]) => run('git', args, { cwd: work });
  const baseBranch = (await git('rev-parse', '--abbrev-ref', 'HEAD')).stdout.trim();
  await git('checkout', '-q', '-b', 'feature');
  await writeFile(join(work, 'PR.md'), 'the change under review\n');
  await git('add', '-A');
  await git('commit', '-q', '--no-verify', '-m', 'The change');
  const headSha = (await git('rev-parse', 'HEAD')).stdout.trim();
  await git('checkout', '-q', baseBranch);
  const bare = join(root, `${name}.git`);
  await run('git', ['clone', '-q', '--bare', work, bare]);
  return { bare, headSha, baseBranch };
}
