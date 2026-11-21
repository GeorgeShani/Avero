import type { RunListItem } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { awaitingDecision, decidedRuns } from './queue';

const run = (
  runId: string,
  startedAt: string,
  review: RunListItem['review'] = {},
  status: RunListItem['status'] = 'FINISHED',
): RunListItem => ({
  runId,
  task: runId,
  model: 'm',
  startedAt,
  status,
  durationMs: 1,
  totalTokens: 1,
  costCents: null,
  toolCalls: 0,
  filesChanged: 0,
  additions: 0,
  deletions: 0,
  review,
});

describe('awaitingDecision', () => {
  it('lists only finished runs nobody has decided on', () => {
    const runs = [
      run('a', '2026-01-01T00:00:00Z'),
      run('b', '2026-01-02T00:00:00Z', { decision: 'approved' }),
      run('c', '2026-01-03T00:00:00Z', {}, 'ERROR'),
      run('d', '2026-01-04T00:00:00Z', {}, 'RUNNING'),
    ];
    expect(awaitingDecision(runs).map((item) => item.runId)).toEqual(['a']);
  });

  it('puts the riskiest first and the newest first within a tier', () => {
    const runs = [
      run('low-old', '2026-01-01T00:00:00Z', { risk: 'low' }),
      run('high-old', '2026-01-02T00:00:00Z', { risk: 'high' }),
      run('high-new', '2026-01-05T00:00:00Z', { risk: 'high' }),
      run('medium', '2026-01-03T00:00:00Z', { risk: 'medium' }),
      run('unreviewed', '2026-01-09T00:00:00Z'),
    ];
    expect(awaitingDecision(runs).map((item) => item.runId)).toEqual([
      'high-new',
      'high-old',
      'medium',
      'unreviewed',
      'low-old',
    ]);
  });

  it('does not change the list it was given', () => {
    const runs = [run('a', '2026-01-01T00:00:00Z'), run('b', '2026-01-02T00:00:00Z')];
    awaitingDecision(runs);
    expect(runs.map((item) => item.runId)).toEqual(['a', 'b']);
  });
});

describe('decidedRuns', () => {
  it('lists decided runs, newest first', () => {
    const runs = [
      run('a', '2026-01-01T00:00:00Z', { decision: 'rejected' }),
      run('b', '2026-01-03T00:00:00Z', { decision: 'approved' }),
      run('c', '2026-01-02T00:00:00Z'),
    ];
    expect(decidedRuns(runs).map((item) => item.runId)).toEqual(['b', 'a']);
  });
});
