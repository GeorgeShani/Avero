import { randomUUID } from 'node:crypto';
import {
  claimTask,
  connectDatabase,
  getTask,
  publishOutbox,
  recoverStaleTasks,
  type AveroDatabase,
} from '@avero/db';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTaskWorker } from '../processors/index.ts';
import { fakeAgent, makeGitRepo, makeRoot, seedTask, purgeTestData } from '../testing/harness.ts';
import { createTaskQueue, enqueueTask } from './index.ts';

// Real PostgreSQL and real Redis. Skipped unless both AVERO_TEST_DATABASE_URL and
// AVERO_TEST_REDIS_URL are set (CI sets them; locally, `pnpm infra:up`).
const databaseUrl = process.env.AVERO_TEST_DATABASE_URL;
const redisUrl = process.env.AVERO_TEST_REDIS_URL;

async function until<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  ms = 15_000,
): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe.skipIf(!databaseUrl || !redisUrl)('the queue, the outbox and recovery', () => {
  let db: AveroDatabase;
  let redis: Redis;
  let root: string;
  let cleanup: () => Promise<void>;
  const queueName = `avero-test-${randomUUID()}`;
  const clerkId = `test-${randomUUID()}`;

  beforeAll(async () => {
    db = connectDatabase(databaseUrl as string);
    redis = new Redis(redisUrl as string, { maxRetriesPerRequest: null });
    ({ root, cleanup } = await makeRoot());
  });
  afterAll(async () => {
    await purgeTestData(db, [clerkId]);
    await createTaskQueue(redis, queueName).obliterate({ force: true });
    await redis.quit();
    await cleanup();
  });

  const start = (agent: ReturnType<typeof fakeAgent>) =>
    createTaskWorker(
      redis,
      { db, roots: [root], sandbox: false, createAgent: agent.createAgent, heartbeatMs: 100 },
      { concurrency: 2, queueName },
    );

  it('takes a task from the database, through the queue, to a finished run', async () => {
    const repo = await makeGitRepo(root, 'through-queue');
    const { workspace, task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    const queue = createTaskQueue(redis, queueName);
    const agent = fakeAgent({ writes: { 'A.md': 'a\n' } });
    const worker = start(agent);
    try {
      await publishOutbox(db, (item) => enqueueTask(queue, item));
      const done = await until(
        () => getTask(db, workspace.id, task.id),
        (value) => value?.status === 'finished',
      );
      expect(done?.status).toBe('finished');
      expect(agent.seen.created).toBe(1);
    } finally {
      await worker.close();
      await queue.close();
    }
  });

  it('keeps one job when the same outbox row is handed over twice', async () => {
    const queue = createTaskQueue(redis, queueName);
    try {
      const outboxId = randomUUID();
      await enqueueTask(queue, { taskId: randomUUID(), outboxId });
      await enqueueTask(queue, { taskId: randomUUID(), outboxId });
      const counts = await queue.getJobCounts('waiting', 'delayed', 'active');
      expect(counts.waiting).toBe(1);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it('puts a task back and runs it again after its worker disappeared', async () => {
    const repo = await makeGitRepo(root, 'lost-worker');
    const { workspace, task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    const queue = createTaskQueue(redis, queueName);
    await publishOutbox(db, async () => undefined); // the first publish never reached a worker

    // A worker took the task and died: it is running, and nothing touches it any more.
    await claimTask(db, task.id);
    await db.execute(
      sql`update tasks set updated_at = now() - interval '5 minutes' where id = ${task.id}`,
    );

    const recovery = await recoverStaleTasks(db, { staleAfterMs: 60_000, maxAttempts: 3 });
    expect(recovery.requeued).toBeGreaterThanOrEqual(1);
    expect((await getTask(db, workspace.id, task.id))?.status).toBe('queued');

    const agent = fakeAgent();
    const worker = start(agent);
    try {
      await publishOutbox(db, (item) => enqueueTask(queue, item));
      const done = await until(
        () => getTask(db, workspace.id, task.id),
        (value) => value?.status === 'finished',
      );
      expect(done?.status).toBe('finished');
      expect(done?.attempt).toBe(2);
      expect(agent.seen.created).toBe(1);
    } finally {
      await worker.close();
      await queue.close();
    }
  });
  it('runs a task whose job the queue lost, after recovery puts it back', async () => {
    const repo = await makeGitRepo(root, 'lost-job');
    const { workspace, task } = await seedTask(db, { repoPath: repo, clerkUserId: clerkId });
    const queue = createTaskQueue(redis, queueName);
    try {
      // The job reaches the queue and the outbox row is marked published...
      await publishOutbox(db, (item) => enqueueTask(queue, item));
      // ...and then the queue loses it (Redis restarted without its data). Nothing is running.
      await queue.obliterate({ force: true });
      await db.execute(
        sql`update task_outbox set published_at = now() - interval '1 hour' where task_id = ${task.id}`,
      );
      expect((await queue.getJobCounts('waiting', 'active', 'delayed')).waiting).toBe(0);
      expect((await getTask(db, workspace.id, task.id))?.status).toBe('queued');

      const recovery = await recoverStaleTasks(db, {
        staleAfterMs: 60_000,
        maxAttempts: 3,
        lostJobAfterMs: 10 * 60_000,
      });
      expect(recovery.republished).toBeGreaterThanOrEqual(1);

      const agent = fakeAgent();
      const worker = start(agent);
      try {
        await publishOutbox(db, (item) => enqueueTask(queue, item));
        const done = await until(
          () => getTask(db, workspace.id, task.id),
          (value) => value?.status === 'finished',
        );
        expect(done?.status).toBe('finished');
        expect(done?.attempt).toBe(1);
        expect(agent.seen.created).toBe(1);
      } finally {
        await worker.close();
      }
    } finally {
      await queue.close();
    }
  });
});
