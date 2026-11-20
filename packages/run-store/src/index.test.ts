import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createRunWriter,
  isRunId,
  listRuns,
  readDecision,
  readRun,
  readVerdict,
  runsDir,
  writeDecision,
  writeVerdict,
} from './index.ts';
import type { Verdict } from '@avero/contracts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-store-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const started = (runId: string, startedAt: string) =>
  JSON.stringify({
    type: 'run.started',
    seq: 0,
    t: 0,
    v: 1,
    runId,
    task: 'Do it',
    model: 'composer-2.5',
    runtime: 'local',
    startedAt,
    workspace: 'demo',
  });

describe('runsDir', () => {
  it('uses AVERO_RUNS_DIR when set, otherwise .avero/runs under the folder', () => {
    expect(runsDir('/work', { AVERO_RUNS_DIR: '/elsewhere' })).toBe('/elsewhere');
    expect(runsDir('/work', {})).toBe(join('/work', '.avero', 'runs'));
  });
});

describe('writing and reading', () => {
  it('appends lines in order and reads them back', async () => {
    const writer = await createRunWriter(dir, 'run-1');
    await writer.write(started('run-1', '2026-11-20T10:00:00.000Z'));
    await writer.write(JSON.stringify({ type: 'status', seq: 1, t: 5, status: 'RUNNING' }));
    const record = await readRun(dir, 'run-1');
    expect(record.started.runId).toBe('run-1');
    expect(record.events).toHaveLength(1);
  });

  it('refuses a run id that could leave the folder', async () => {
    expect(isRunId('../secrets')).toBe(false);
    expect(isRunId('run-1')).toBe(true);
    await expect(readRun(dir, '../secrets')).rejects.toThrow(/valid run id/);
    await expect(createRunWriter(dir, 'a/b')).rejects.toThrow(/valid run id/);
  });
});

describe('listRuns', () => {
  it('returns an empty list when the folder does not exist', async () => {
    expect(await listRuns(join(dir, 'missing'))).toEqual({ runs: [], problems: [] });
  });

  it('lists runs newest first and reports a broken file instead of hiding it', async () => {
    await writeFile(join(dir, 'old.jsonl'), started('old', '2026-11-19T10:00:00.000Z'));
    await writeFile(join(dir, 'new.jsonl'), started('new', '2026-11-20T10:00:00.000Z'));
    await writeFile(join(dir, 'broken.jsonl'), 'not json');
    await writeFile(join(dir, 'notes.txt'), 'ignored');
    const { runs, problems } = await listRuns(dir);
    expect(runs.map((run) => run.runId)).toEqual(['new', 'old']);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe('broken.jsonl');
  });
});

const verdict = (runId: string, tier: 'low' | 'medium' | 'high' = 'medium'): Verdict => ({
  v: 1,
  runId,
  summary: 'It retries but the delay is fixed.',
  checks: [
    { id: 'c1', claim: 'Retries', verdict: 'pass', evidence: 'loop' },
    { id: 'c2', claim: 'Exponential', verdict: 'fail', evidence: 'fixed delay' },
  ],
  outOfScope: [],
  tests: { ran: true, passed: true, evidence: 'npm test exit 0' },
  risk: { tier, reasons: ['A check failed.'] },
  reviewer: { model: 'composer-2.5', reviewedAt: '2026-11-20T11:00:00.000Z' },
  adjustments: [],
});

describe('verdicts and decisions', () => {
  it('writes and reads a verdict beside the run, and reads nothing when there is none', async () => {
    expect(await readVerdict(dir, 'run-1')).toBeUndefined();
    await writeVerdict(dir, verdict('run-1'));
    expect((await readVerdict(dir, 'run-1'))?.risk.tier).toBe('medium');
  });

  it('refuses to write a verdict that does not match the schema, or a run id that leaves the folder', async () => {
    const bad = { ...verdict('run-1'), checks: [] } as Verdict;
    await expect(writeVerdict(dir, bad)).rejects.toThrow();
    await expect(writeVerdict(dir, verdict('../x'))).rejects.toThrow(/valid run id/);
    await expect(readDecision(dir, '../x')).rejects.toThrow(/valid run id/);
  });

  it('replaces an earlier decision with a new one', async () => {
    const base = { v: 1 as const, runId: 'run-1', decidedAt: '2026-11-20T12:00:00.000Z' };
    await writeDecision(dir, { ...base, decision: 'changes-requested', note: 'use jitter' });
    await writeDecision(dir, { ...base, decision: 'approved' });
    const decision = await readDecision(dir, 'run-1');
    expect(decision?.decision).toBe('approved');
    expect(decision?.note).toBeUndefined();
  });

  it('shows the risk, failed checks and decision of each run in the listing', async () => {
    await writeFile(join(dir, 'run-1.jsonl'), started('run-1', '2026-11-20T10:00:00.000Z'));
    await writeFile(join(dir, 'run-2.jsonl'), started('run-2', '2026-11-19T10:00:00.000Z'));
    await writeVerdict(dir, verdict('run-1', 'high'));
    await writeDecision(dir, {
      v: 1,
      runId: 'run-1',
      decision: 'rejected',
      decidedAt: '2026-11-20T12:00:00.000Z',
    });
    const { runs } = await listRuns(dir);
    expect(runs[0]?.review).toEqual({ risk: 'high', failedChecks: 1, decision: 'rejected' });
    expect(runs[1]?.review).toEqual({});
  });

  it('reports a run whose verdict file is broken instead of dropping it silently', async () => {
    await writeFile(join(dir, 'run-1.jsonl'), started('run-1', '2026-11-20T10:00:00.000Z'));
    await writeFile(join(dir, 'run-1.verdict.json'), '{"nope":true}');
    const { runs, problems } = await listRuns(dir);
    expect(runs).toHaveLength(0);
    expect(problems[0]?.file).toBe('run-1.jsonl');
  });
});
