import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BenchResult, BenchSuite, Hillclimb } from '@avero/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  benchRoot,
  listBenchResults,
  listHillclimbs,
  listSuites,
  readBenchResult,
  readHillclimb,
  readSuite,
  writeBenchResult,
  writeHillclimb,
  writeSuite,
} from './bench.ts';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'avero-bench-store-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const sha = 'a'.repeat(40);
const suite = (id: string, createdAt = '2026-11-21T10:00:00.000Z'): BenchSuite => ({
  v: 1,
  id,
  createdAt,
  repo: { name: 'demo', head: sha },
  testCommand: 'npm test',
  tasks: [
    {
      id: 't1',
      title: 'Add retries',
      prompt: 'Add retries to deliver',
      baseSha: sha,
      solutionSha: 'b'.repeat(40),
      testFiles: ['deliver.test.js'],
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
  configs: [{ id: 'a', label: 'A', model: 'composer-2.5', rules: [] }],
  cells: [],
});

describe('benchRoot', () => {
  it('sits beside the runs folder', () => {
    expect(benchRoot(join('/work', '.avero', 'runs'))).toBe(join('/work', '.avero', 'bench'));
  });
});

describe('suites', () => {
  it('writes, reads and lists suites newest first, and reads nothing when there is none', async () => {
    expect(await readSuite(root, 'demo')).toBeUndefined();
    await writeSuite(root, suite('old', '2026-11-19T10:00:00.000Z'));
    await writeSuite(root, suite('new', '2026-11-21T10:00:00.000Z'));
    expect((await readSuite(root, 'new'))?.tasks).toHaveLength(1);
    expect((await listSuites(root)).map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('refuses an id that could leave the folder', async () => {
    await expect(readSuite(root, '../x')).rejects.toThrow(/valid suite id/);
    await expect(writeSuite(root, suite('../x'))).rejects.toThrow();
  });

  it('refuses to write a suite that does not match the schema', async () => {
    await expect(writeSuite(root, { ...suite('x'), tasks: [] })).rejects.toThrow();
  });
});

describe('results', () => {
  it("lists a suite's results newest first and skips a broken file", async () => {
    await writeBenchResult(root, result('r1', 'demo', '2026-11-20T10:00:00.000Z'));
    await writeBenchResult(root, result('r2', 'demo', '2026-11-21T10:00:00.000Z'));
    await writeFile(join(root, 'demo', 'results', 'broken.json'), '{"nope":true}');
    expect((await listBenchResults(root, 'demo')).map((entry) => entry.id)).toEqual(['r2', 'r1']);
    expect((await readBenchResult(root, 'demo', 'r1'))?.suiteId).toBe('demo');
    expect(await readBenchResult(root, 'demo', 'missing')).toBeUndefined();
  });

  it('is empty for a suite with no results yet', async () => {
    expect(await listBenchResults(root, 'demo')).toEqual([]);
  });
});

describe('hillclimbs', () => {
  const climb = (id: string): Hillclimb => ({
    v: 1,
    id,
    suiteId: 'demo',
    model: 'composer-2.5',
    rulesPath: 'AGENTS.md',
    startedAt: '2026-11-21T10:00:00.000Z',
    holdoutTaskIds: [],
    iterations: [
      {
        n: 0,
        rules: '',
        rationale: '',
        resolved: 1,
        attempts: 2,
        tokensPerResolved: 2000,
        kept: true,
        reason: 'Starting rules.',
      },
    ],
    bestIteration: 0,
  });

  it('writes, reads and lists them', async () => {
    await writeHillclimb(root, climb('h1'));
    expect((await readHillclimb(root, 'demo', 'h1'))?.bestIteration).toBe(0);
    expect((await listHillclimbs(root, 'demo')).map((entry) => entry.id)).toEqual(['h1']);
    expect(await readHillclimb(root, 'demo', 'nope')).toBeUndefined();
  });
});
