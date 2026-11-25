import { describe, expect, it } from 'vitest';
import { crumbs } from './crumbs';

describe('crumbs', () => {
  it('names a top-level page, and treats the root as Overview', () => {
    expect(crumbs('/runs')).toEqual([{ label: 'Runs' }]);
    expect(crumbs('/')).toEqual([{ label: 'Overview' }]);
  });

  it('falls back to the id when a page has not named itself', () => {
    expect(crumbs('/runs/run-abc')).toEqual([
      { label: 'Runs', href: '/runs' },
      { label: 'run-abc' },
    ]);
  });

  it('uses the name a page registered for its path', () => {
    expect(crumbs('/tasks/123', { '/tasks/123': 'Fix the retry test' })).toEqual([
      { label: 'Tasks', href: '/tasks' },
      { label: 'Fix the retry test' },
    ]);
  });

  it('names each deeper step by its own path and links the middle one', () => {
    expect(
      crumbs('/evaluations/suite-1/result-9', {
        '/evaluations/suite-1': 'Billing suite',
        '/evaluations/suite-1/result-9': '2026-11-20 10:00',
      }),
    ).toEqual([
      { label: 'Evaluations', href: '/evaluations' },
      { label: 'Billing suite', href: '/evaluations/suite-1' },
      { label: '2026-11-20 10:00' },
    ]);
  });

  it('keeps a long name to one short line', () => {
    const long = 'Retry failed webhook deliveries with exponential backoff, at most four attempts';
    const [, last] = crumbs('/runs/r', { '/runs/r': long });
    expect(last?.label.length).toBeLessThanOrEqual(49);
    expect(last?.label.endsWith('…')).toBe(true);
  });
});
