import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BenchResult, BenchSuite } from '@avero/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeBenchResult, writeSuite, benchRoot } from './bench.ts';
import { fileRunSource } from './source.ts';

let base: string;
let runs: string;
beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'avero-source-'));
  runs = join(base, '.avero', 'runs');
  await mkdir(runs, { recursive: true });
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
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

const sha = 'a'.repeat(40);
const suite = (id: string): BenchSuite => ({
  v: 1,
  id,
  createdAt: '2026-11-21T10:00:00.000Z',
  repo: { name: 'demo', head: sha },
  testCommand: 'npm test',
  tasks: [
    {
      id: 't1',
      title: 'Add retries',
      prompt: 'Add retries',
      baseSha: sha,
      solutionSha: 'b'.repeat(40),
      testFiles: ['a.test.js'],
      source: { kind: 'commit', subject: 'Add retries' },
    },
  ],
});
const result = (id: string, suiteId: string, startedAt: string): BenchResult => ({
  v: 1,
  id,
  suiteId,
  startedAt,
  repeats: 1,
  configs: [{ id: 'c1', label: 'plain', model: 'composer-2.5', rules: [] }],
  cells: [],
});

describe('fileRunSource: runs', () => {
  it('labels itself with the folder it reads', () => {
    expect(fileRunSource(runs).label).toBe(runs);
  });

  it('lists runs newest first through the listing the console already used', async () => {
    await writeFile(join(runs, 'old.jsonl'), started('old', '2026-11-19T10:00:00.000Z'));
    await writeFile(join(runs, 'new.jsonl'), started('new', '2026-11-20T10:00:00.000Z'));
    const { runs: listed } = await fileRunSource(runs).listRuns();
    expect(listed.map((run) => run.runId)).toEqual(['new', 'old']);
  });

  it('answers undefined for a run that is missing or has an unsafe id, and throws for a broken one', async () => {
    const source = fileRunSource(runs);
    expect(await source.getRun('nope')).toBeUndefined();
    expect(await source.getRun('../secrets')).toBeUndefined();
    await writeFile(join(runs, 'broken.jsonl'), 'not json');
    await expect(source.getRun('broken')).rejects.toThrow();
  });

  it('saves a decision and reads it back with the run', async () => {
    await writeFile(join(runs, 'r1.jsonl'), started('r1', '2026-11-20T10:00:00.000Z'));
    const source = fileRunSource(runs);
    await source.saveDecision({
      v: 1,
      runId: 'r1',
      decision: 'approved',
      decidedAt: '2026-11-20T11:00:00.000Z',
    });
    const loaded = await source.getRun('r1');
    expect(loaded?.decision?.decision).toBe('approved');
    expect((await source.listRuns()).runs[0]?.review.decision).toBe('approved');
  });

  it('refuses a decision for a run that does not exist', async () => {
    await expect(
      fileRunSource(runs).saveDecision({
        v: 1,
        runId: 'ghost',
        decision: 'rejected',
        decidedAt: '2026-11-20T11:00:00.000Z',
      }),
    ).rejects.toThrow();
  });
});

describe('fileRunSource: bench', () => {
  it('finds a suite with its results, and the latest result across suites', async () => {
    const bench = benchRoot(runs);
    await writeSuite(bench, suite('one'));
    await writeSuite(bench, suite('two'));
    await writeBenchResult(bench, result('r-old', 'one', '2026-11-21T10:00:00.000Z'));
    await writeBenchResult(bench, result('r-new', 'two', '2026-11-22T10:00:00.000Z'));
    const source = fileRunSource(runs);

    expect((await source.listSuites()).map((item) => item.id).sort()).toEqual(['one', 'two']);
    expect((await source.getSuite('one'))?.results.map((item) => item.id)).toEqual(['r-old']);
    expect(await source.getSuite('missing')).toBeUndefined();
    expect((await source.latestBench())?.result.id).toBe('r-new');
    expect((await source.getBenchItem('one', 'r-old'))?.result?.id).toBe('r-old');
    expect(await source.getBenchItem('one', 'nope')).toBeUndefined();
  });

  it('has nothing to report when there is no bench folder', async () => {
    const source = fileRunSource(runs);
    expect(await source.listSuites()).toEqual([]);
    expect(await source.latestBench()).toBeUndefined();
  });
});
