import { describe, expect, it } from 'vitest';
import {
  benchResultSchema,
  benchSuiteSchema,
  cheapestConfig,
  configMetrics,
  estimateCents,
  repoPathSchema,
  wilsonInterval,
  type BenchCell,
  type BenchResult,
} from './bench.ts';

const usage = (total: number, input = total, output = 0) => ({
  inputTokens: input,
  outputTokens: output,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: total,
});

const cell = (overrides: Partial<BenchCell>): BenchCell => ({
  taskId: 't1',
  configId: 'a',
  repeat: 0,
  outcome: 'resolved',
  testsExitCode: 0,
  testsOutput: '',
  costCents: null,
  durationMs: 10_000,
  usage: usage(1000),
  ...overrides,
});

const result = (cells: BenchCell[]): BenchResult => ({
  v: 1,
  id: 'run-1',
  suiteId: 'suite-1',
  startedAt: '2026-11-21T10:00:00.000Z',
  repeats: 1,
  configs: [
    { id: 'a', label: 'Baseline', model: 'composer-2.5', rules: [] },
    { id: 'b', label: 'With rules', model: 'composer-2.5', rules: [] },
  ],
  cells,
});

describe('repoPathSchema', () => {
  it('accepts paths inside the repository and refuses ones that leave it', () => {
    expect(repoPathSchema.safeParse('src/a.test.ts').success).toBe(true);
    expect(repoPathSchema.safeParse('../secrets').success).toBe(false);
    expect(repoPathSchema.safeParse('a/../../b').success).toBe(false);
    expect(repoPathSchema.safeParse('/etc/passwd').success).toBe(false);
    expect(repoPathSchema.safeParse('C:\\Windows\\x').success).toBe(false);
    expect(repoPathSchema.safeParse('').success).toBe(false);
  });
});

describe('schemas', () => {
  const sha = 'a'.repeat(40);
  const suite = {
    v: 1,
    id: 'demo',
    createdAt: '2026-11-21T10:00:00.000Z',
    repo: { name: 'demo', head: sha },
    testCommand: 'npm test',
    tasks: [
      {
        id: 'retry',
        title: 'Retry',
        prompt: 'Add retries',
        baseSha: sha,
        solutionSha: 'b'.repeat(40),
        testFiles: ['deliver.test.js'],
        source: { kind: 'commit', subject: 'Add retries' },
      },
    ],
  };

  it('accepts a suite and rejects a short hash or a test file that escapes the repo', () => {
    expect(benchSuiteSchema.safeParse(suite).success).toBe(true);
    const shortSha = { ...suite, tasks: [{ ...suite.tasks[0], baseSha: 'abc123' }] };
    expect(benchSuiteSchema.safeParse(shortSha).success).toBe(false);
    const escaping = { ...suite, tasks: [{ ...suite.tasks[0], testFiles: ['../x.test.js'] }] };
    expect(benchSuiteSchema.safeParse(escaping).success).toBe(false);
  });

  it('accepts a result and refuses an unknown outcome', () => {
    expect(benchResultSchema.safeParse(result([cell({})])).success).toBe(true);
    expect(benchResultSchema.safeParse(result([cell({ outcome: 'maybe' as never })])).success).toBe(
      false,
    );
  });
});

describe('wilsonInterval', () => {
  it('is wide for few attempts and narrows with more', () => {
    const few = wilsonInterval(3, 4);
    const many = wilsonInterval(75, 100);
    expect(few.high - few.low).toBeGreaterThan(0.4);
    expect(many.high - many.low).toBeLessThan(0.2);
  });

  it('stays inside 0 to 1, and covers nothing known when there are no attempts', () => {
    expect(wilsonInterval(4, 4).high).toBeLessThanOrEqual(1);
    expect(wilsonInterval(0, 4).low).toBe(0);
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe('estimateCents', () => {
  it('prices input, output and cached input separately', () => {
    const cents = estimateCents(
      {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheReadTokens: 400_000,
        cacheWriteTokens: 0,
        totalTokens: 1_100_000,
      },
      { inputPerMillion: 1, outputPerMillion: 5, cacheReadPerMillion: 0.1 },
    );
    // 600k uncached input at $1/M, 100k output at $5/M, 400k cached at $0.10/M
    expect(cents).toBeCloseTo((0.6 + 0.5 + 0.04) * 100, 6);
  });
});

describe('configMetrics', () => {
  it('counts outcomes and the pass rate, with errors counted as not resolved', () => {
    const r = result([
      cell({}),
      cell({ taskId: 't2', outcome: 'unresolved', testsExitCode: 1 }),
      cell({ taskId: 't3', outcome: 'error', testsExitCode: null }),
      cell({ taskId: 't4' }),
    ]);
    const metrics = configMetrics(r, 'a');
    expect(metrics).toMatchObject({
      attempts: 4,
      resolved: 2,
      unresolved: 1,
      errors: 1,
      passRate: 0.5,
    });
  });

  it('spreads everything spent, failed attempts included, over the resolved ones', () => {
    const r = result([
      cell({ usage: usage(1000), durationMs: 10_000 }),
      cell({ taskId: 't2', outcome: 'unresolved', usage: usage(3000), durationMs: 30_000 }),
    ]);
    const metrics = configMetrics(r, 'a');
    expect(metrics.tokensPerResolved).toBe(4000);
    expect(metrics.secondsPerResolved).toBe(40);
  });

  it('is null per resolved task when nothing resolved', () => {
    const metrics = configMetrics(result([cell({ outcome: 'unresolved' })]), 'a');
    expect(metrics.tokensPerResolved).toBeNull();
    expect(metrics.costPerResolvedCents).toBeNull();
  });

  it('uses billed cost when every attempt has it, and says so', () => {
    const r = result([
      cell({ costCents: 10 }),
      cell({ taskId: 't2', outcome: 'unresolved', costCents: 30 }),
    ]);
    const metrics = configMetrics(r, 'a');
    expect(metrics.costSource).toBe('billed');
    expect(metrics.costPerResolvedCents).toBe(40);
  });

  it('estimates from a price table when billing is missing, and says so', () => {
    const r = result([cell({ usage: usage(1_000_000, 1_000_000, 0) })]);
    const metrics = configMetrics(r, 'a', {
      'composer-2.5': { inputPerMillion: 2, outputPerMillion: 10 },
    });
    expect(metrics.costSource).toBe('estimated');
    expect(metrics.costPerResolvedCents).toBeCloseTo(200, 6);
  });

  it('does not invent a cost without billing or a price', () => {
    const metrics = configMetrics(result([cell({})]), 'a');
    expect(metrics.costSource).toBe('unknown');
    expect(metrics.costPerResolvedCents).toBeNull();
  });
});

describe('cheapestConfig', () => {
  it('picks the lowest cost per resolved task, not the lowest total spend', () => {
    const r = result([
      cell({ configId: 'a', usage: usage(1000) }),
      cell({ configId: 'a', taskId: 't2', outcome: 'unresolved', usage: usage(1000) }),
      cell({ configId: 'b', usage: usage(1500) }),
      cell({ configId: 'b', taskId: 't2', usage: usage(1500) }),
    ]);
    // a: 2000 tokens / 1 resolved = 2000. b: 3000 / 2 = 1500.
    expect(cheapestConfig(r)).toBe('b');
  });

  it('is undefined when nothing resolved', () => {
    expect(cheapestConfig(result([cell({ outcome: 'unresolved' })]))).toBeUndefined();
  });
});
