import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  connectDatabase,
  dbRunSource,
  getTask,
  listTaskEvents,
  requestCancel,
  type AveroDatabase,
} from '@avero/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processTask } from '../processors/index.ts';
import {
  fakeAgent,
  makeGitRepo,
  makeRoot,
  seedTask,
  worktreeCount,
  purgeTestData,
} from '../testing/harness.ts';

// Real PostgreSQL, a real git repository, a fake agent. Skipped unless AVERO_TEST_DATABASE_URL is set.
const url = process.env.AVERO_TEST_DATABASE_URL;

describe.skipIf(!url)('running a task end to end', () => {
  let db: AveroDatabase;
  let root: string;
  let cleanup: () => Promise<void>;
  const clerkId = `test-${randomUUID()}`;

  beforeAll(async () => {
    db = connectDatabase(url as string);
    ({ root, cleanup } = await makeRoot());
  });
  afterAll(async () => {
    await purgeTestData(db, [clerkId]);
    await cleanup();
  });

  const deps = (agent: ReturnType<typeof fakeAgent>) => ({
    db,
    roots: [root],
    sandbox: false,
    createAgent: agent.createAgent,
    heartbeatMs: 100,
  });

  it('runs the agent in a throwaway checkout, saves the run and its events, and leaves the repository alone', async () => {
    const repo = await makeGitRepo(root, 'finishes');
    const { workspace, task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    const agent = fakeAgent({ writes: { 'NOTES.md': 'hello\n' } });

    expect(await processTask(task.id, deps(agent))).toBe('ran');

    const done = await getTask(db, workspace.id, task.id);
    expect(done).toMatchObject({ status: 'finished', attempt: 1, error: null });
    expect(done?.runId).toMatch(/^run-/);
    expect(agent.seen.created).toBe(1);
    expect(agent.seen.cwds[0]).not.toBe(repo);

    const loaded = await dbRunSource(db, workspace).getRun(done?.runId as string);
    expect(loaded?.record.finished?.status).toBe('FINISHED');
    expect(loaded?.record.finished?.changes?.files.map((file) => file.path)).toEqual(['NOTES.md']);
    expect(agent.seen.guardInstalled).toEqual([true]);
    expect(agent.seen.settingSources).toEqual([['project']]);

    const events = await listTaskEvents(db, workspace.id, task.id);
    expect(events.at(0)?.event.type).toBe('run.started');
    expect(events.at(-1)?.event.type).toBe('run.finished');
    expect(events.map((event) => event.seq)).toEqual(
      [...events.map((event) => event.seq)].sort((a, b) => a - b),
    );

    await expect(access(join(repo, 'NOTES.md'))).rejects.toThrow();
    expect(await worktreeCount(repo)).toBe(1);
  });

  it('leaves the guard out, and project settings unloaded, when it is turned off', async () => {
    const repo = await makeGitRepo(root, 'no-guard');
    const { task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    const agent = fakeAgent();
    await processTask(task.id, { ...deps(agent), guard: false });
    expect(agent.seen.guardInstalled).toEqual([false]);
    expect(agent.seen.settingSources).toEqual([undefined]);
  });

  it('ignores a duplicate job for a task that already ran', async () => {
    const repo = await makeGitRepo(root, 'duplicate');
    const { task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    const agent = fakeAgent();
    expect(await processTask(task.id, deps(agent))).toBe('ran');
    expect(await processTask(task.id, deps(agent))).toBe('skipped');
    expect(agent.seen.created).toBe(1);
  });

  it('stops a running task when it is cancelled, and records it as cancelled', async () => {
    const repo = await makeGitRepo(root, 'cancels');
    const { workspace, task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    const agent = fakeAgent({ untilCancelled: true });

    const running = processTask(task.id, deps(agent));
    // Wait until the worker has really started the agent.
    for (let i = 0; i < 100 && agent.seen.created === 0; i++)
      await new Promise((r) => setTimeout(r, 50));
    expect(agent.seen.created).toBe(1);
    expect((await requestCancel(db, workspace.id, task.id))?.status).toBe('cancelling');

    await running;
    const done = await getTask(db, workspace.id, task.id);
    expect(done?.status).toBe('cancelled');
    expect(agent.seen.cancels).toBeGreaterThanOrEqual(1);
    const loaded = await dbRunSource(db, workspace).getRun(done?.runId as string);
    expect(loaded?.record.finished?.status).toBe('CANCELLED');
    expect(await worktreeCount(repo)).toBe(1);
  });

  it('fails a task whose agent errored, with the reason, and still saves the run', async () => {
    const repo = await makeGitRepo(root, 'errors');
    const { workspace, task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    await processTask(task.id, deps(fakeAgent({ fail: 'The model was unavailable.' })));
    const done = await getTask(db, workspace.id, task.id);
    expect(done).toMatchObject({ status: 'failed' });
    expect(done?.error).toContain('The model was unavailable.');
    expect(done?.runId).toMatch(/^run-/);
  });

  it('refuses a repository outside the folders the worker may use, and never starts the agent', async () => {
    const other = await makeRoot();
    try {
      const repo = await makeGitRepo(other.root, 'outside');
      const { workspace, task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
      const agent = fakeAgent();
      await processTask(task.id, deps(agent));
      const done = await getTask(db, workspace.id, task.id);
      expect(done).toMatchObject({ status: 'failed' });
      expect(done?.error).toMatch(/outside the folders/);
      expect(agent.seen.created).toBe(0);
    } finally {
      await other.cleanup();
    }
  });

  it('fails a task whose folder is not a git repository, with a message', async () => {
    const { workspace, task } = await seedTask(db, { repoPath: root, clerkUserId: clerkId });
    await processTask(task.id, deps(fakeAgent()));
    const done = await getTask(db, workspace.id, task.id);
    expect(done?.status).toBe('failed');
    expect(done?.error).not.toBeNull();
  });
});
