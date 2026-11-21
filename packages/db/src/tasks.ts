import {
  canTransition,
  taskEventSchema,
  taskSchema,
  type Repository,
  type RepositoryCreate,
  type RunEvent,
  type Task,
  type TaskCreate,
  taskSourceSchema,
  type TaskEvent,
  type TaskSource,
  type TaskStatus,
} from '@avero/contracts';
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { AveroDatabase } from './client.ts';
import { agents, repositories, taskEvents, taskOutbox, tasks, users } from './schema/index.ts';

type TaskRow = typeof tasks.$inferSelect;

function toTask(row: TaskRow): Task {
  return taskSchema.parse({
    id: row.id,
    repositoryId: row.repositoryId,
    agentId: row.agentId,
    prompt: row.prompt,
    model: row.model,
    status: row.status,
    review: row.review,
    attempt: row.attempt,
    maxTokens: row.maxTokens,
    maxSeconds: row.maxSeconds,
    runId: row.runId,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  });
}

// ---- repositories --------------------------------------------------------------------------

/** Registers a folder on the worker's machine. The caller has checked the path against the roots. */
export async function addLocalRepository(
  db: AveroDatabase,
  workspaceId: string,
  input: RepositoryCreate,
): Promise<Repository> {
  const [row] = await db
    .insert(repositories)
    .values({ workspaceId, name: input.name, kind: 'local', path: input.path })
    .returning();
  if (!row) throw new Error('Could not save the repository.');
  return { id: row.id, name: row.name, kind: 'local', createdAt: row.createdAt.toISOString() };
}

export async function listRepositories(
  db: AveroDatabase,
  workspaceId: string,
): Promise<Repository[]> {
  const rows = await db
    .select()
    .from(repositories)
    .where(eq(repositories.workspaceId, workspaceId))
    .orderBy(asc(repositories.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** The folder of a repository, for the worker only. */
export async function repositoryFolder(
  db: AveroDatabase,
  repositoryId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ path: repositories.path })
    .from(repositories)
    .where(eq(repositories.id, repositoryId));
  return row?.path ?? undefined;
}

// ---- tasks ---------------------------------------------------------------------------------

/**
 * Creates a task and its outbox row in one transaction, so it is queued if and only if it was
 * saved. The repository must belong to the workspace.
 */
export function createTask(
  db: AveroDatabase,
  workspaceId: string,
  input: TaskCreate,
  options: {
    defaultModel: string;
    createdBy?: { clerkUserId: string };
    /** What started it, when it was not a person. */
    source?: TaskSource;
  },
): Promise<Task> {
  return db.transaction(async (tx) => {
    const [repository] = await tx
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(eq(repositories.id, input.repositoryId), eq(repositories.workspaceId, workspaceId)),
      );
    if (!repository) throw new Error('There is no such repository.');
    const [agent] = input.agentId
      ? await tx
          .select({ id: agents.id, model: agents.model })
          .from(agents)
          .where(and(eq(agents.id, input.agentId), eq(agents.workspaceId, workspaceId)))
      : [];
    if (input.agentId && !agent) throw new Error('There is no such agent.');
    const [creator] = options.createdBy
      ? await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkUserId, options.createdBy.clerkUserId))
      : [];

    const [row] = await tx
      .insert(tasks)
      .values({
        workspaceId,
        repositoryId: input.repositoryId,
        agentId: agent?.id ?? null,
        prompt: input.prompt,
        // An explicit model wins, then the agent's, then the server's default.
        model: input.model ?? agent?.model ?? options.defaultModel,
        review: input.review ?? false,
        maxTokens: input.limits?.maxTokens ?? null,
        maxSeconds: input.limits?.maxSeconds ?? null,
        createdBy: creator?.id ?? null,
        source: options.source ?? null,
      })
      .returning();
    if (!row) throw new Error('Could not save the task.');
    await tx.insert(taskOutbox).values({ taskId: row.id });
    return toTask(row);
  });
}

export async function listTasks(
  db: AveroDatabase,
  workspaceId: string,
  limit = 50,
): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);
  return rows.map(toTask);
}

export async function getTask(
  db: AveroDatabase,
  workspaceId: string,
  taskId: string,
): Promise<Task | undefined> {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)));
  return row ? toTask(row) : undefined;
}

/**
 * Asks a task to stop. A queued task is cancelled on the spot; a running one is marked
 * `cancelling` and its worker stops it; anything else is returned as it is, so asking twice, or
 * too late, is harmless. Undefined when the task is not in this workspace.
 */
export function requestCancel(
  db: AveroDatabase,
  workspaceId: string,
  taskId: string,
): Promise<Task | undefined> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
      .for('update');
    if (!row) return undefined;
    const target: TaskStatus | undefined =
      row.status === 'queued' ? 'cancelled' : row.status === 'running' ? 'cancelling' : undefined;
    if (!target || !canTransition(row.status, target)) return toTask(row);
    const [updated] = await tx
      .update(tasks)
      .set({
        status: target,
        updatedAt: sql`now()`,
        ...(target === 'cancelled' ? { finishedAt: sql`now()` } : {}),
      })
      .where(eq(tasks.id, taskId))
      .returning();
    return toTask(updated ?? row);
  });
}

// ---- what the worker does ------------------------------------------------------------------

export type ClaimedTask = {
  id: string;
  workspaceId: string;
  repositoryId: string;
  prompt: string;
  model: string;
  review: boolean;
  attempt: number;
  maxTokens: number | null;
  maxSeconds: number | null;
  /** The pull request that started it, if one did. */
  source: TaskSource | null;
  /** The rules of the agent definition it was launched with; empty when it had none. */
  rules: string;
};

/**
 * Takes a queued task for this worker. Only one caller can win: the update only matches while the
 * task is still `queued`, so a duplicate job, or a task cancelled meanwhile, yields nothing.
 */
export async function claimTask(
  db: AveroDatabase,
  taskId: string,
): Promise<ClaimedTask | undefined> {
  const [row] = await db
    .update(tasks)
    .set({
      status: 'running',
      attempt: sql`${tasks.attempt} + 1`,
      startedAt: sql`now()`,
      updatedAt: sql`now()`,
      error: null,
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.status, 'queued')))
    .returning();
  if (!row) return undefined;
  const [agent] = row.agentId
    ? await db.select({ rules: agents.rules }).from(agents).where(eq(agents.id, row.agentId))
    : [];
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    rules: agent?.rules ?? '',
    repositoryId: row.repositoryId,
    prompt: row.prompt,
    model: row.model,
    review: row.review,
    attempt: row.attempt,
    maxTokens: row.maxTokens,
    maxSeconds: row.maxSeconds,
    source: row.source ? taskSourceSchema.parse(row.source) : null,
  };
}

/** Tells everyone the worker is alive, and answers whether a stop was requested. */
export async function heartbeat(
  db: AveroDatabase,
  taskId: string,
): Promise<{ cancelRequested: boolean }> {
  const [row] = await db
    .update(tasks)
    .set({ updatedAt: sql`now()` })
    .where(and(eq(tasks.id, taskId), inArray(tasks.status, ['running', 'cancelling'])))
    .returning({ status: tasks.status });
  return { cancelRequested: row?.status === 'cancelling' };
}

/** Forgets the events of an earlier attempt, before a task is started again. */
export async function clearTaskEvents(db: AveroDatabase, taskId: string): Promise<void> {
  await db.delete(taskEvents).where(eq(taskEvents.taskId, taskId));
}

/** Appends events to a task's log. Writing the same sequence number twice is ignored. */
export async function appendTaskEvents(
  db: AveroDatabase,
  taskId: string,
  events: readonly { seq: number; at: string; event: RunEvent }[],
): Promise<void> {
  if (events.length === 0) return;
  await db
    .insert(taskEvents)
    .values(
      events.map((item) => ({ taskId, seq: item.seq, at: new Date(item.at), event: item.event })),
    )
    .onConflictDoNothing();
}

export async function listTaskEvents(
  db: AveroDatabase,
  workspaceId: string,
  taskId: string,
  options: { after?: number; limit?: number } = {},
): Promise<TaskEvent[]> {
  const rows = await db
    .select({ seq: taskEvents.seq, at: taskEvents.at, event: taskEvents.event })
    .from(taskEvents)
    .innerJoin(tasks, eq(tasks.id, taskEvents.taskId))
    .where(
      and(
        eq(taskEvents.taskId, taskId),
        eq(tasks.workspaceId, workspaceId),
        gt(taskEvents.seq, options.after ?? -1),
      ),
    )
    .orderBy(asc(taskEvents.seq))
    .limit(options.limit ?? 500);
  return rows.map((row) =>
    taskEventSchema.parse({ seq: row.seq, at: row.at.toISOString(), event: row.event }),
  );
}

/**
 * Ends a task. It only takes effect from a state the lifecycle allows, so a task that was already
 * cancelled or recovered by someone else is not overwritten. Returns whether this call ended it.
 */
export async function finishTask(
  db: AveroDatabase,
  taskId: string,
  outcome: { status: 'finished' | 'failed' | 'cancelled'; runId?: string; error?: string },
): Promise<boolean> {
  const from = (['running', 'cancelling'] as const).filter((status) =>
    canTransition(status, outcome.status),
  );
  if (from.length === 0) return false;
  const rows = await db
    .update(tasks)
    .set({
      status: outcome.status,
      runId: outcome.runId ?? null,
      error: outcome.error ?? null,
      finishedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(tasks.id, taskId), inArray(tasks.status, from)))
    .returning({ id: tasks.id });
  return rows.length > 0;
}

// ---- the outbox ----------------------------------------------------------------------------

/**
 * Hands every unpublished task to `publish` (which puts it on the queue) and marks it published.
 * It all happens in one transaction with `FOR UPDATE SKIP LOCKED`, so two relays never publish the
 * same row, and if `publish` throws nothing is marked and the rows are tried again. `publish` should
 * use `outboxId` as the job id: the queue ignores an id it already holds, so a retry after a crash
 * cannot queue the same row twice, and the claim below stops a duplicate from running a task twice.
 */
export function publishOutbox(
  db: AveroDatabase,
  publish: (item: { taskId: string; outboxId: string }) => Promise<void>,
  limit = 50,
): Promise<number> {
  return db.transaction(async (tx) => {
    const pending = await tx
      .select({ id: taskOutbox.id, taskId: taskOutbox.taskId })
      .from(taskOutbox)
      .where(isNull(taskOutbox.publishedAt))
      .orderBy(asc(taskOutbox.createdAt))
      .limit(limit)
      .for('update', { skipLocked: true });
    for (const row of pending) {
      await publish({ taskId: row.taskId, outboxId: row.id });
      await tx
        .update(taskOutbox)
        .set({ publishedAt: sql`now()` })
        .where(eq(taskOutbox.id, row.id));
    }
    return pending.length;
  });
}

// ---- recovery ------------------------------------------------------------------------------

export type Recovery = {
  requeued: number;
  failed: number;
  cancelled: number;
  /** Queued tasks whose job had been lost from the queue, put on it again. */
  republished: number;
};

/**
 * Finds tasks whose worker stopped touching them (it crashed or was killed) and settles them: a
 * running task is queued again while it has attempts left and failed after that; a task that was
 * being cancelled is cancelled. A requeued task gets a new outbox row, so it reaches the queue.
 *
 * With `lostJobAfterMs`, a task still `queued` whose newest outbox row was published longer ago
 * than that, with nothing waiting to be published, is put on the queue again. That is the case
 * where the queue lost the job (Redis restarted without its data, or the queue was flushed): the
 * database says "queued" and nothing will ever start it. A job that is only waiting its turn is
 * put on twice at worst, and the claim makes the second one a no-op.
 */
export function recoverStaleTasks(
  db: AveroDatabase,
  options: { staleAfterMs: number; maxAttempts: number; lostJobAfterMs?: number },
): Promise<Recovery> {
  return db.transaction(async (tx) => {
    const cutoff = new Date(Date.now() - options.staleAfterMs);
    const stale = await tx
      .select()
      .from(tasks)
      .where(and(inArray(tasks.status, ['running', 'cancelling']), lt(tasks.updatedAt, cutoff)))
      .for('update', { skipLocked: true });
    const result: Recovery = { requeued: 0, failed: 0, cancelled: 0, republished: 0 };
    for (const task of stale) {
      if (task.status === 'cancelling') {
        await tx
          .update(tasks)
          .set({ status: 'cancelled', finishedAt: sql`now()`, updatedAt: sql`now()` })
          .where(eq(tasks.id, task.id));
        result.cancelled += 1;
      } else if (task.attempt < options.maxAttempts) {
        await tx
          .update(tasks)
          .set({ status: 'queued', updatedAt: sql`now()` })
          .where(eq(tasks.id, task.id));
        await tx.insert(taskOutbox).values({ taskId: task.id });
        result.requeued += 1;
      } else {
        await tx
          .update(tasks)
          .set({
            status: 'failed',
            error: 'The worker stopped before the task finished, too many times.',
            finishedAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(eq(tasks.id, task.id));
        result.failed += 1;
      }
    }

    if (options.lostJobAfterMs !== undefined) {
      const lostCutoff = new Date(Date.now() - options.lostJobAfterMs);
      const lost = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.status, 'queued'),
            sql`not exists (
              select 1 from ${taskOutbox}
              where ${taskOutbox.taskId} = ${tasks.id}
                and (${taskOutbox.publishedAt} is null or ${taskOutbox.publishedAt} > ${lostCutoff.toISOString()}::timestamptz)
            )`,
          ),
        )
        .for('update', { skipLocked: true });
      for (const task of lost) {
        await tx.insert(taskOutbox).values({ taskId: task.id });
        result.republished += 1;
      }
    }
    return result;
  });
}
