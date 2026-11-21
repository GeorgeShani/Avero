import {
  benchResultSchema,
  benchSuiteSchema,
  decisionSchema,
  hillclimbSchema,
  parseRunRecord,
  summarizeRun,
  verdictSchema,
  type BenchResult,
  type BenchSuite,
  type Decision,
  type Hillclimb,
  type RunListItem,
  type RunSource,
  type Verdict,
} from '@avero/contracts';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { AveroDatabase } from './client.ts';
import {
  benchResults,
  benchSuites,
  hillclimbs,
  runDecisions,
  runs,
  users,
  verdicts,
} from './schema/index.ts';

export type SavedRun = { runId: string; created: boolean };

/**
 * Saves a recorded run in a workspace, with its verdict and decision when it has them. Pushing the
 * same run again replaces it, so a client can retry safely. The record is validated first: a file
 * that is not a run record is refused, not stored.
 */
export async function saveRun(
  db: AveroDatabase,
  workspaceId: string,
  input: {
    record: string;
    verdict?: unknown;
    decision?: unknown;
    pushedBy?: { clerkUserId: string };
  },
): Promise<SavedRun> {
  const record = parseRunRecord(input.record);
  const summary = summarizeRun(record);
  const verdict = input.verdict === undefined ? undefined : verdictSchema.parse(input.verdict);
  const decision = input.decision === undefined ? undefined : decisionSchema.parse(input.decision);
  if (verdict && verdict.runId !== summary.runId)
    throw new Error('The verdict is for a different run.');
  if (decision && decision.runId !== summary.runId)
    throw new Error('The decision is for a different run.');

  return db.transaction(async (tx) => {
    const pusher = input.pushedBy
      ? (
          await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.clerkUserId, input.pushedBy.clerkUserId))
        )[0]
      : undefined;

    const values = {
      workspaceId,
      runId: summary.runId,
      task: summary.task,
      model: summary.model,
      status: summary.status,
      startedAt: new Date(summary.startedAt),
      durationMs: Math.round(summary.durationMs),
      totalTokens: summary.totalTokens,
      costCents: summary.costCents,
      toolCalls: summary.toolCalls,
      filesChanged: summary.filesChanged,
      additions: summary.additions,
      deletions: summary.deletions,
      record: input.record,
      pushedBy: pusher?.id ?? null,
    };
    const [saved] = await tx
      .insert(runs)
      .values(values)
      .onConflictDoUpdate({
        target: [runs.workspaceId, runs.runId],
        set: { ...values, pushedAt: sql`now()` },
      })
      .returning({ id: runs.id, created: sql<boolean>`(xmax = 0)` });
    if (!saved) throw new Error('Could not save the run.');

    if (verdict) {
      const row = {
        runPk: saved.id,
        risk: verdict.risk.tier,
        failedChecks: verdict.checks.filter((check) => check.verdict === 'fail').length,
        data: verdict,
        reviewedAt: new Date(verdict.reviewer.reviewedAt),
      };
      await tx
        .insert(verdicts)
        .values(row)
        .onConflictDoUpdate({ target: verdicts.runPk, set: row });
    }
    if (decision) await upsertDecision(tx, saved.id, decision, pusher?.id ?? null);
    return { runId: summary.runId, created: saved.created };
  });
}

type Executor = Pick<AveroDatabase, 'insert'>;

async function upsertDecision(
  executor: Executor,
  runPk: string,
  decision: Decision,
  decidedBy: string | null,
) {
  const row = {
    runPk,
    decision: decision.decision,
    note: decision.note ?? null,
    decidedAt: new Date(decision.decidedAt),
    decidedBy,
  };
  await executor.insert(runDecisions).values(row).onConflictDoUpdate({
    target: runDecisions.runPk,
    set: row,
  });
}

/** Saves a bench suite, replacing one with the same id in the workspace. */
export async function saveBenchSuite(db: AveroDatabase, workspaceId: string, input: unknown) {
  const suite = benchSuiteSchema.parse(input);
  const row = {
    workspaceId,
    slug: suite.id,
    data: suite,
    createdAt: new Date(suite.createdAt),
  };
  await db
    .insert(benchSuites)
    .values(row)
    .onConflictDoUpdate({ target: [benchSuites.workspaceId, benchSuites.slug], set: row });
  return suite.id;
}

async function suitePk(db: AveroDatabase, workspaceId: string, slug: string) {
  const [suite] = await db
    .select({ id: benchSuites.id })
    .from(benchSuites)
    .where(and(eq(benchSuites.workspaceId, workspaceId), eq(benchSuites.slug, slug)));
  return suite?.id;
}

/** Saves a bench result under its suite, which must already be in the workspace. */
export async function saveBenchResult(db: AveroDatabase, workspaceId: string, input: unknown) {
  const result = benchResultSchema.parse(input);
  const pk = await suitePk(db, workspaceId, result.suiteId);
  if (!pk) throw new Error('There is no such suite.');
  const row = {
    suitePk: pk,
    resultId: result.id,
    startedAt: new Date(result.startedAt),
    data: result,
  };
  await db
    .insert(benchResults)
    .values(row)
    .onConflictDoUpdate({ target: [benchResults.suitePk, benchResults.resultId], set: row });
  return result.id;
}

/** Saves a hillclimb under its suite, which must already be in the workspace. */
export async function saveHillclimb(db: AveroDatabase, workspaceId: string, input: unknown) {
  const climb = hillclimbSchema.parse(input);
  const pk = await suitePk(db, workspaceId, climb.suiteId);
  if (!pk) throw new Error('There is no such suite.');
  const row = {
    suitePk: pk,
    hillclimbId: climb.id,
    startedAt: new Date(climb.startedAt),
    data: climb,
  };
  await db
    .insert(hillclimbs)
    .values(row)
    .onConflictDoUpdate({ target: [hillclimbs.suitePk, hillclimbs.hillclimbId], set: row });
  return climb.id;
}

/**
 * The run source for a hosted workspace. Every query is filtered by the workspace id, so one
 * workspace never sees another's runs. Who may read or decide is the caller's to check first.
 */
export function dbRunSource(
  db: AveroDatabase,
  workspace: { id: string; name: string },
  options: { decidedBy?: { clerkUserId: string } } = {},
): RunSource {
  const decisionOf = (
    runId: string,
    row: { decision: Decision['decision']; note: string | null; decidedAt: Date },
  ): Decision =>
    decisionSchema.parse({
      v: 1,
      runId,
      decision: row.decision,
      ...(row.note ? { note: row.note } : {}),
      decidedAt: row.decidedAt.toISOString(),
    });

  return {
    label: workspace.name,

    async listRuns() {
      const rows = await db
        .select({
          run: runs,
          risk: verdicts.risk,
          failedChecks: verdicts.failedChecks,
          decision: runDecisions.decision,
        })
        .from(runs)
        .leftJoin(verdicts, eq(verdicts.runPk, runs.id))
        .leftJoin(runDecisions, eq(runDecisions.runPk, runs.id))
        .where(eq(runs.workspaceId, workspace.id))
        .orderBy(desc(runs.startedAt));
      const list: RunListItem[] = rows.map(({ run, risk, failedChecks, decision }) => ({
        runId: run.runId,
        task: run.task,
        model: run.model,
        startedAt: run.startedAt.toISOString(),
        status: run.status,
        durationMs: run.durationMs,
        totalTokens: run.totalTokens,
        costCents: run.costCents,
        toolCalls: run.toolCalls,
        filesChanged: run.filesChanged,
        additions: run.additions,
        deletions: run.deletions,
        review: {
          ...(risk ? { risk, failedChecks: failedChecks ?? 0 } : {}),
          ...(decision ? { decision } : {}),
        },
      }));
      return { runs: list, problems: [] };
    },

    async getRun(runId) {
      const [row] = await db
        .select({
          pk: runs.id,
          record: runs.record,
          verdict: verdicts.data,
          decision: runDecisions.decision,
          note: runDecisions.note,
          decidedAt: runDecisions.decidedAt,
        })
        .from(runs)
        .leftJoin(verdicts, eq(verdicts.runPk, runs.id))
        .leftJoin(runDecisions, eq(runDecisions.runPk, runs.id))
        .where(and(eq(runs.workspaceId, workspace.id), eq(runs.runId, runId)));
      if (!row) return undefined;
      const verdict: Verdict | undefined = row.verdict
        ? verdictSchema.parse(row.verdict)
        : undefined;
      const decision =
        row.decision && row.decidedAt
          ? decisionOf(runId, { decision: row.decision, note: row.note, decidedAt: row.decidedAt })
          : undefined;
      return {
        record: parseRunRecord(row.record),
        ...(verdict ? { verdict } : {}),
        ...(decision ? { decision } : {}),
      };
    },

    async saveDecision(decision) {
      const [run] = await db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.workspaceId, workspace.id), eq(runs.runId, decision.runId)));
      if (!run) throw new Error('There is no such run.');
      const [pusher] = options.decidedBy
        ? await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.clerkUserId, options.decidedBy.clerkUserId))
        : [];
      await upsertDecision(db, run.id, decisionSchema.parse(decision), pusher?.id ?? null);
    },

    async listSuites() {
      const rows = await db
        .select({ data: benchSuites.data })
        .from(benchSuites)
        .where(eq(benchSuites.workspaceId, workspace.id))
        .orderBy(desc(benchSuites.createdAt));
      return rows.map((row) => benchSuiteSchema.parse(row.data));
    },

    async getSuite(slug) {
      const [row] = await db
        .select({ id: benchSuites.id, data: benchSuites.data })
        .from(benchSuites)
        .where(and(eq(benchSuites.workspaceId, workspace.id), eq(benchSuites.slug, slug)));
      if (!row) return undefined;
      const [results, climbs] = await Promise.all([
        db
          .select({ data: benchResults.data })
          .from(benchResults)
          .where(eq(benchResults.suitePk, row.id))
          .orderBy(desc(benchResults.startedAt)),
        db
          .select({ data: hillclimbs.data })
          .from(hillclimbs)
          .where(eq(hillclimbs.suitePk, row.id))
          .orderBy(desc(hillclimbs.startedAt)),
      ]);
      return {
        suite: benchSuiteSchema.parse(row.data),
        results: results.map((item): BenchResult => benchResultSchema.parse(item.data)),
        hillclimbs: climbs.map((item): Hillclimb => hillclimbSchema.parse(item.data)),
      };
    },

    async getBenchItem(slug, id) {
      const [suiteRow] = await db
        .select({ id: benchSuites.id, data: benchSuites.data })
        .from(benchSuites)
        .where(and(eq(benchSuites.workspaceId, workspace.id), eq(benchSuites.slug, slug)));
      if (!suiteRow) return undefined;
      const suite: BenchSuite = benchSuiteSchema.parse(suiteRow.data);
      const [result] = await db
        .select({ data: benchResults.data })
        .from(benchResults)
        .where(and(eq(benchResults.suitePk, suiteRow.id), eq(benchResults.resultId, id)));
      if (result) return { suite, result: benchResultSchema.parse(result.data) };
      const [climb] = await db
        .select({ data: hillclimbs.data })
        .from(hillclimbs)
        .where(and(eq(hillclimbs.suitePk, suiteRow.id), eq(hillclimbs.hillclimbId, id)));
      return climb ? { suite, hillclimb: hillclimbSchema.parse(climb.data) } : undefined;
    },

    async latestBench() {
      const [row] = await db
        .select({ suite: benchSuites.data, result: benchResults.data })
        .from(benchResults)
        .innerJoin(benchSuites, eq(benchSuites.id, benchResults.suitePk))
        .where(eq(benchSuites.workspaceId, workspace.id))
        .orderBy(desc(benchResults.startedAt))
        .limit(1);
      return row
        ? { suite: benchSuiteSchema.parse(row.suite), result: benchResultSchema.parse(row.result) }
        : undefined;
    },
  };
}
