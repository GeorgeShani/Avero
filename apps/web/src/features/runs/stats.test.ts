import type { RunListItem } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { overviewStats } from './stats';

const run = (overrides: Partial<RunListItem>): RunListItem => ({
  runId: 'r',
  task: 't',
  model: 'm',
  startedAt: '2026-11-20T10:00:00.000Z',
  status: 'FINISHED',
  durationMs: 10_000,
  totalTokens: 1000,
  costCents: null,
  toolCalls: 3,
  filesChanged: 1,
  additions: 10,
  deletions: 2,
  review: {},
  ...overrides,
});

describe('overviewStats', () => {
  it('is all zeros, with no average or cost, when there are no runs', () => {
    expect(overviewStats([])).toEqual({
      runs: 0,
      running: 0,
      finished: 0,
      failed: 0,
      stopped: 0,
      totalTokens: 0,
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      averageDurationMs: null,
      costCents: null,
      awaitingDecision: 0,
      awaitingRisky: 0,
    });
  });

  it('counts each outcome and totals tokens and changes', () => {
    const stats = overviewStats([
      run({}),
      run({ status: 'ERROR', durationMs: 2000, totalTokens: 0, additions: 0, deletions: 0 }),
      run({ status: 'CANCELLED' }),
      run({ status: 'RUNNING' }),
    ]);
    expect(stats).toMatchObject({
      runs: 4,
      running: 1,
      finished: 1,
      failed: 1,
      stopped: 1,
      totalTokens: 3000,
      additions: 30,
      deletions: 6,
    });
  });

  it('averages only finished runs, and sums only the cost that was reported', () => {
    const stats = overviewStats([
      run({ durationMs: 10_000, costCents: 2 }),
      run({ durationMs: 30_000, costCents: null }),
      run({ status: 'ERROR', durationMs: 999_999, costCents: 5 }),
    ]);
    expect(stats.averageDurationMs).toBe(20_000);
    expect(stats.costCents).toBe(7);
  });

  it('counts finished runs nobody has decided on, and how many of them are risky', () => {
    const stats = overviewStats([
      run({ review: { risk: 'low' } }),
      run({ review: { risk: 'high' } }),
      run({ review: { risk: 'medium', decision: 'approved' } }),
      run({}),
      run({ status: 'ERROR', review: { risk: 'high' } }),
    ]);
    expect(stats.awaitingDecision).toBe(3);
    expect(stats.awaitingRisky).toBe(1);
  });
});
