import { randomUUID } from 'node:crypto';
import type { RunEvent } from '@avero/contracts';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase, type AveroDatabase } from './client.ts';
import { tasks, taskOutbox, users, workspaces } from './schema/index.ts';
import {
  addLocalRepository,
  appendTaskEvents,
  claimTask,
  clearTaskEvents,
  createTask,
  finishTask,
  getTask,
  heartbeat,
  listRepositories,
  listTaskEvents,
  listTasks,
  publishOutbox,
  recoverStaleTasks,
  repositoryFolder,
  requestCancel,
} from './tasks.ts';
import { createWorkspace } from './workspaces.ts';

// Real PostgreSQL, like the run tests: skipped unless AVERO_TEST_DATABASE_URL is set.
const url = process.env.AVERO_TEST_DATABASE_URL;

const note = (seq: number): { seq: number; at: string; event: RunEvent } => ({
  seq,
  at: '2026-11-21T10:00:00.000Z',
  event: { type: 'note', seq, t: seq * 10, text: `event ${seq}` },
});

describe.skipIf(!url)('tasks in the database', () => {
  let db: AveroDatabase;
  const clerkIds = [`test-${randomUUID()}`, `test-${randomUUID()}`];
  let a: { id: string };
  let b: { id: string };
  let repoA: string;
  let repoB: string;

  const make = (workspaceId = a.id, repositoryId = repoA, prompt = 'Do it') =>
    createTask(
      db,
      workspaceId,
      { repositoryId, prompt },
      { defaultModel: 'composer-2.5', createdBy: { clerkUserId: clerkIds[0] as string } },
    );

  beforeAll(async () => {
    db = connectDatabase(url as string);
    a = await createWorkspace(db, { clerkUserId: clerkIds[0] as string, email: null }, 'Tasks A');
    b = await createWorkspace(db, { clerkUserId: clerkIds[1] as string, email: null }, 'Tasks B');
    repoA = (await addLocalRepository(db, a.id, { name: 'demo', path: '/work/demo' })).id;
    repoB = (await addLocalRepository(db, b.id, { name: 'demo', path: '/work/other' })).id;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(inArray(workspaces.id, [a.id, b.id]));
    await db.delete(users).where(inArray(users.clerkUserId, clerkIds));
  });

  it('keeps repositories per workspace and never shows their folder to a listing', async () => {
    const listed = await listRepositories(db, a.id);
    expect(listed.map((repo) => repo.name)).toEqual(['demo']);
    expect(JSON.stringify(listed)).not.toContain('/work');
    expect(await repositoryFolder(db, repoA)).toBe('/work/demo');
    await expect(addLocalRepository(db, a.id, { name: 'demo', path: '/x' })).rejects.toThrow();
  });

  it('creates a queued task with an outbox row, and refuses another workspace’s repository', async () => {
    const task = await make();
    expect(task).toMatchObject({
      status: 'queued',
      attempt: 0,
      model: 'composer-2.5',
      review: false,
    });
    const outbox = await db.select().from(taskOutbox).where(eq(taskOutbox.taskId, task.id));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.publishedAt).toBeNull();
    await expect(make(a.id, repoB)).rejects.toThrow(/no such repository/);
    expect((await listTasks(db, b.id)).some((item) => item.id === task.id)).toBe(false);
    expect(await getTask(db, b.id, task.id)).toBeUndefined();
  });

  it('lets only one worker claim a task', async () => {
    const task = await make();
    const claims = await Promise.all(Array.from({ length: 5 }, () => claimTask(db, task.id)));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await getTask(db, a.id, task.id))?.status).toBe('running');
    expect((await getTask(db, a.id, task.id))?.attempt).toBe(1);
    expect(await claimTask(db, task.id)).toBeUndefined();
  });

  it('cancels a queued task at once, and a running one by marking it for its worker', async () => {
    const queued = await make();
    expect((await requestCancel(db, a.id, queued.id))?.status).toBe('cancelled');
    expect(await claimTask(db, queued.id)).toBeUndefined();

    const running = await make();
    await claimTask(db, running.id);
    expect((await requestCancel(db, a.id, running.id))?.status).toBe('cancelling');
    expect((await heartbeat(db, running.id)).cancelRequested).toBe(true);
    expect((await requestCancel(db, a.id, running.id))?.status).toBe('cancelling');
    expect(await finishTask(db, running.id, { status: 'cancelled' })).toBe(true);
    expect((await requestCancel(db, a.id, running.id))?.status).toBe('cancelled');
  });

  it('cannot cancel a task from another workspace', async () => {
    const task = await make();
    expect(await requestCancel(db, b.id, task.id)).toBeUndefined();
    expect((await getTask(db, a.id, task.id))?.status).toBe('queued');
  });

  it('ends a task only from a state the lifecycle allows', async () => {
    const task = await make();
    expect(await finishTask(db, task.id, { status: 'finished' })).toBe(false);
    await claimTask(db, task.id);
    expect(await finishTask(db, task.id, { status: 'finished', runId: 'run-1' })).toBe(true);
    expect(await finishTask(db, task.id, { status: 'failed', error: 'late' })).toBe(false);
    expect(await getTask(db, a.id, task.id)).toMatchObject({ status: 'finished', runId: 'run-1' });
  });

  it('stores events in order, ignores a repeated sequence number, and scopes them to the workspace', async () => {
    const task = await make();
    await appendTaskEvents(db, task.id, [note(0), note(1), note(2)]);
    await appendTaskEvents(db, task.id, [note(2), note(3)]);
    const all = await listTaskEvents(db, a.id, task.id);
    expect(all.map((item) => item.seq)).toEqual([0, 1, 2, 3]);
    expect((await listTaskEvents(db, a.id, task.id, { after: 1 })).map((item) => item.seq)).toEqual(
      [2, 3],
    );
    expect(await listTaskEvents(db, b.id, task.id)).toEqual([]);
    await clearTaskEvents(db, task.id);
    expect(await listTaskEvents(db, a.id, task.id)).toEqual([]);
  });

  it('publishes outbox rows once, leaves them when publishing fails, and never double-publishes', async () => {
    // Settle whatever earlier tests left, so this one counts only its own tasks.
    await publishOutbox(db, async () => undefined, 1000);
    const one = await make();
    const two = await make();

    await expect(
      publishOutbox(db, async () => {
        throw new Error('queue down');
      }),
    ).rejects.toThrow('queue down');
    const seen: string[] = [];
    const results = await Promise.all([
      publishOutbox(db, async ({ taskId }) => void seen.push(taskId)),
      publishOutbox(db, async ({ taskId }) => void seen.push(taskId)),
    ]);
    expect(results.reduce((sum, n) => sum + n, 0)).toBe(2);
    expect(seen.sort()).toEqual([one.id, two.id].sort());
    expect(await publishOutbox(db, async () => undefined)).toBe(0);
  });

  it('recovers tasks whose worker disappeared', async () => {
    const stale = async (status: 'running' | 'cancelling', attempt: number) => {
      const task = await make();
      await db
        .update(tasks)
        .set({ status, attempt, updatedAt: sql`now() - interval '10 minutes'` })
        .where(eq(tasks.id, task.id));
      return task.id;
    };
    const retry = await stale('running', 1);
    const exhausted = await stale('running', 3);
    const stopping = await stale('cancelling', 1);
    const alive = await make();
    await claimTask(db, alive.id);

    const result = await recoverStaleTasks(db, { staleAfterMs: 60_000, maxAttempts: 3 });
    expect(result.requeued).toBeGreaterThanOrEqual(1);
    expect((await getTask(db, a.id, retry))?.status).toBe('queued');
    expect((await getTask(db, a.id, exhausted))?.status).toBe('failed');
    expect((await getTask(db, a.id, exhausted))?.error).toMatch(/worker stopped/);
    expect((await getTask(db, a.id, stopping))?.status).toBe('cancelled');
    expect((await getTask(db, a.id, alive.id))?.status).toBe('running');
    const outbox = await db.select().from(taskOutbox).where(eq(taskOutbox.taskId, retry));
    expect(outbox.some((row) => row.publishedAt === null)).toBe(true);
  });
  it('puts a queued task on the queue again when its job was lost, and only then', async () => {
    await publishOutbox(db, async () => undefined, 1000);
    const lost = await make();
    const waiting = await make();
    const unpublished = await make();
    const running = await make();
    await publishOutbox(db, async () => undefined, 1000);
    await claimTask(db, running.id);
    // `lost` and `running` were published an hour ago; `waiting` just now. `unpublished` gets a
    // fresh outbox row that has not been published yet.
    await db
      .update(taskOutbox)
      .set({ publishedAt: sql`now() - interval '1 hour'` })
      .where(inArray(taskOutbox.taskId, [lost.id, running.id, unpublished.id]));
    await db.insert(taskOutbox).values({ taskId: unpublished.id });

    const result = await recoverStaleTasks(db, {
      staleAfterMs: 60_000,
      maxAttempts: 3,
      lostJobAfterMs: 10 * 60_000,
    });
    expect(result.republished).toBe(1);
    const rows = async (id: string) =>
      db.select().from(taskOutbox).where(eq(taskOutbox.taskId, id));
    expect((await rows(lost.id)).filter((row) => row.publishedAt === null)).toHaveLength(1);
    expect(await rows(waiting.id)).toHaveLength(1);
    expect(await rows(unpublished.id)).toHaveLength(2);
    expect(await rows(running.id)).toHaveLength(1);

    // A second pass does not pile up more rows for the same task.
    const again = await recoverStaleTasks(db, {
      staleAfterMs: 60_000,
      maxAttempts: 3,
      lostJobAfterMs: 10 * 60_000,
    });
    expect(again.republished).toBe(0);
    expect(await rows(lost.id)).toHaveLength(2);
  });

  it('leaves queued tasks alone unless told how long a job may be lost', async () => {
    const task = await make();
    await publishOutbox(db, async () => undefined, 1000);
    await db
      .update(taskOutbox)
      .set({ publishedAt: sql`now() - interval '1 day'` })
      .where(eq(taskOutbox.taskId, task.id));
    const result = await recoverStaleTasks(db, { staleAfterMs: 60_000, maxAttempts: 3 });
    expect(result.republished).toBe(0);
  });
});
