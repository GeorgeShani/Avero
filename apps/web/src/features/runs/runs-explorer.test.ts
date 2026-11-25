import type { RunListItem } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { matchesShow } from './runs-explorer';

function run(status: RunListItem['status'], decision?: 'approved'): RunListItem {
  return {
    runId: 'r',
    task: 't',
    model: 'm',
    startedAt: '2026-11-20T10:00:00.000Z',
    status,
    durationMs: 1,
    totalTokens: 1,
    costCents: null,
    toolCalls: 0,
    filesChanged: 0,
    additions: 0,
    deletions: 0,
    review: decision ? { decision } : {},
  };
}

describe('matchesShow', () => {
  it('shows everything under All', () => {
    for (const status of ['FINISHED', 'ERROR', 'CANCELLED', 'EXPIRED', 'RUNNING'] as const)
      expect(matchesShow(run(status), 'all')).toBe(true);
  });

  it('shows finished runs nobody decided on under To decide', () => {
    expect(matchesShow(run('FINISHED'), 'undecided')).toBe(true);
    expect(matchesShow(run('FINISHED', 'approved'), 'undecided')).toBe(false);
    expect(matchesShow(run('ERROR'), 'undecided')).toBe(false);
  });

  it('keeps failures apart from runs that were stopped', () => {
    expect(matchesShow(run('ERROR'), 'failed')).toBe(true);
    expect(matchesShow(run('CANCELLED'), 'failed')).toBe(false);
    expect(matchesShow(run('CANCELLED'), 'stopped')).toBe(true);
    expect(matchesShow(run('EXPIRED'), 'stopped')).toBe(true);
    expect(matchesShow(run('FINISHED'), 'stopped')).toBe(false);
  });
});
