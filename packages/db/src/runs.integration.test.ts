import { randomUUID } from 'node:crypto';
import type { Verdict } from '@avero/contracts';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase, type AveroDatabase } from './client.ts';
import { dbRunSource, saveBenchResult, saveBenchSuite, saveRun } from './runs.ts';
import { users, workspaces } from './schema/index.ts';
import { createWorkspace } from './workspaces.ts';

// These talk to a real PostgreSQL. They run when AVERO_TEST_DATABASE_URL is set (CI sets it; locally
// `pnpm infra:up` and the URL from .env.example do) and are skipped, not faked, when it is not.
const url = process.env.AVERO_TEST_DATABASE_URL;

const started = (runId: string, startedAt: string) =>
  JSON.stringify({
    type: 'run.started',
    seq: 0,
    t: 0,
    v: 1,
    runId,
    task: `Task of ${runId}`,
    model: 'composer-2.5',
    runtime: 'local',
    startedAt,
    workspace: 'demo',
  });

const finished = (status: 'FINISHED' | 'CANCELLED') =>
  JSON.stringify({
    type: 'run.finished',
    seq: 1,
    t: 5000,
    status,
    durationMs: 5000,
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 15,
    },
  });

const record = (
  runId: string,
  startedAt = '2026-11-20T10:00:00.000Z',
  status: 'FINISHED' | 'CANCELLED' = 'FINISHED',
) => `${started(runId, startedAt)}\n${finished(status)}\n`;

const verdict = (runId: string): Verdict => ({
  v: 1,
  runId,
  summary: 'Looks right.',
  checks: [{ id: 'c1', claim: 'Does the thing', verdict: 'fail', evidence: 'It does not.' }],
  outOfScope: [],
  tests: { ran: false, evidence: 'Nothing ran.' },
  risk: { tier: 'high', reasons: ['A check failed.'] },
  reviewer: { model: 'composer-2.5', reviewedAt: '2026-11-20T11:00:00.000Z' },
  adjustments: [],
});

const sha = 'a'.repeat(40);
const suite = {
  v: 1,
  id: 'demo',
  createdAt: '2026-11-21T10:00:00.000Z',
  repo: { name: 'demo', head: sha },
  testCommand: 'npm test',
  tasks: [
    {
      id: 't1',
      title: 'Add',
      prompt: 'Add',
      baseSha: sha,
      solutionSha: 'b'.repeat(40),
      testFiles: ['a.test.js'],
      source: { kind: 'commit', subject: 'Add' },
    },
  ],
};
const benchResult = (id: string, startedAt: string) => ({
  v: 1,
  id,
  suiteId: 'demo',
  startedAt,
  repeats: 1,
  configs: [{ id: 'c1', label: 'plain', model: 'composer-2.5', rules: [] }],
  cells: [],
});

describe.skipIf(!url)('database run source', () => {
  let db: AveroDatabase;
  const clerkIds = [`test-${randomUUID()}`, `test-${randomUUID()}`];
  let a: { id: string; name: string };
  let b: { id: string; name: string };

  beforeAll(async () => {
    db = connectDatabase(url as string);
    a = await createWorkspace(db, { clerkUserId: clerkIds[0] as string, email: null }, 'Test A');
    b = await createWorkspace(db, { clerkUserId: clerkIds[1] as string, email: null }, 'Test B');
  });

  afterAll(async () => {
    await db.delete(workspaces).where(inArray(workspaces.id, [a.id, b.id]));
    await db.delete(users).where(inArray(users.clerkUserId, clerkIds));
  });

  it('saves a run and lists it with its review state, newest first', async () => {
    await saveRun(db, a.id, { record: record('old', '2026-11-19T10:00:00.000Z') });
    await saveRun(db, a.id, {
      record: record('new', '2026-11-20T10:00:00.000Z', 'CANCELLED'),
      verdict: verdict('new'),
    });
    const { runs, problems } = await dbRunSource(db, a).listRuns();
    expect(problems).toEqual([]);
    expect(runs.map((run) => run.runId)).toEqual(['new', 'old']);
    expect(runs[0]).toMatchObject({
      status: 'CANCELLED',
      totalTokens: 15,
      review: { risk: 'high', failedChecks: 1 },
    });
    expect(runs[1]?.review).toEqual({});
  });

  it("never shows one workspace's runs to another", async () => {
    await saveRun(db, a.id, { record: record('shared-name') });
    expect((await dbRunSource(db, b).listRuns()).runs).toEqual([]);
    expect(await dbRunSource(db, b).getRun('shared-name')).toBeUndefined();
    await saveRun(db, b.id, { record: record('shared-name', '2026-11-21T10:00:00.000Z') });
    const mine = await dbRunSource(db, a).getRun('shared-name');
    const theirs = await dbRunSource(db, b).getRun('shared-name');
    expect(mine?.record.started.startedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(theirs?.record.started.startedAt).toBe('2026-11-21T10:00:00.000Z');
  });

  it('pushing the same run again replaces it instead of failing', async () => {
    const first = await saveRun(db, a.id, { record: record('again') });
    const second = await saveRun(db, a.id, {
      record: record('again', '2026-11-20T10:00:00.000Z', 'CANCELLED'),
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect((await dbRunSource(db, a).getRun('again'))?.record.finished?.status).toBe('CANCELLED');
  });

  it('refuses what is not a run record, and a verdict for another run', async () => {
    await expect(saveRun(db, a.id, { record: 'not json' })).rejects.toThrow();
    await expect(
      saveRun(db, a.id, { record: record('x1'), verdict: verdict('other') }),
    ).rejects.toThrow(/different run/);
    expect(await dbRunSource(db, a).getRun('x1')).toBeUndefined();
  });

  it('saves a decision, reads it back, and replaces it', async () => {
    const source = dbRunSource(db, a);
    await source.saveDecision({
      v: 1,
      runId: 'old',
      decision: 'rejected',
      note: 'no',
      decidedAt: '2026-11-20T12:00:00.000Z',
    });
    await source.saveDecision({
      v: 1,
      runId: 'old',
      decision: 'approved',
      decidedAt: '2026-11-20T13:00:00.000Z',
    });
    const loaded = await source.getRun('old');
    expect(loaded?.decision).toEqual({
      v: 1,
      runId: 'old',
      decision: 'approved',
      decidedAt: '2026-11-20T13:00:00.000Z',
    });
    const listed = (await source.listRuns()).runs.find((run) => run.runId === 'old');
    expect(listed?.review.decision).toBe('approved');
  });

  it('cannot decide on a run in another workspace', async () => {
    await expect(
      dbRunSource(db, b).saveDecision({
        v: 1,
        runId: 'old',
        decision: 'approved',
        decidedAt: '2026-11-20T12:00:00.000Z',
      }),
    ).rejects.toThrow(/no such run/);
  });

  it('keeps bench suites and results per workspace', async () => {
    await saveBenchSuite(db, a.id, suite);
    await saveBenchResult(db, a.id, benchResult('r1', '2026-11-21T10:00:00.000Z'));
    await saveBenchResult(db, a.id, benchResult('r2', '2026-11-22T10:00:00.000Z'));
    const mine = dbRunSource(db, a);
    expect((await mine.getSuite('demo'))?.results.map((item) => item.id)).toEqual(['r2', 'r1']);
    expect((await mine.latestBench())?.result.id).toBe('r2');
    expect((await mine.getBenchItem('demo', 'r1'))?.result?.id).toBe('r1');
    expect(await dbRunSource(db, b).getSuite('demo')).toBeUndefined();
    expect(await dbRunSource(db, b).latestBench()).toBeUndefined();
    await expect(
      saveBenchResult(db, b.id, benchResult('r3', '2026-11-23T10:00:00.000Z')),
    ).rejects.toThrow(/no such suite/);
  });

  it('removes a workspace together with everything it holds', async () => {
    const temp = await createWorkspace(
      db,
      { clerkUserId: clerkIds[0] as string, email: null },
      'Temp',
    );
    await saveRun(db, temp.id, { record: record('gone') });
    await db.delete(workspaces).where(eq(workspaces.id, temp.id));
    expect((await dbRunSource(db, temp).listRuns()).runs).toEqual([]);
  });
});
