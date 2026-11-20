import type { RunListItem } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { renderIndexPage } from './index-page.ts';

const run = (overrides: Partial<RunListItem> = {}): RunListItem => ({
  runId: 'run-1',
  task: 'Add retries',
  model: 'composer-2.5',
  startedAt: '2026-11-20T10:00:00.000Z',
  status: 'FINISHED',
  durationMs: 30_000,
  totalTokens: 49_567,
  costCents: null,
  toolCalls: 7,
  filesChanged: 2,
  additions: 58,
  deletions: 5,
  review: { risk: 'low', failedChecks: 0, decision: 'approved' },
  ...overrides,
});

describe('renderIndexPage', () => {
  it('lists runs with links to runs/<id>, their risk and their decision', () => {
    const html = renderIndexPage([
      run(),
      run({ runId: 'run-2', task: 'Fix flaky test', review: { risk: 'high', failedChecks: 2 } }),
      run({ runId: 'run-3', status: 'ERROR', review: {} }),
    ]);
    expect(html).toContain('<a href="runs/run-1">Add retries</a>');
    expect(html).toContain('<a href="runs/run-2">Fix flaky test</a>');
    expect(html).toContain('low risk');
    expect(html).toContain('high risk · 2 failed');
    expect(html).toContain('Approved');
    expect(html).toContain('1 finished and not yet decided');
    expect(html).toContain('2 files +58 −5');
    expect(html).toContain('49,567');
    expect(html).toContain('30.0 s');
  });

  it('is self-contained: strict policy, no script, no network references', () => {
    const html = renderIndexPage([run()]);
    expect(html).toContain("default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/\b(?:src)\s*=/);
  });

  it('escapes everything that comes from a record', () => {
    const attack = '<img src=x onerror=alert(1)>"\'&';
    const html = renderIndexPage([run({ runId: 'run-x', task: attack, model: attack })], {
      problems: [{ file: attack, message: attack }],
      title: attack,
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
  });

  it('encodes the run id in the link', () => {
    const html = renderIndexPage([run({ runId: 'a b"c' })]);
    expect(html).toContain('href="runs/a%20b%22c"');
  });

  it('says so when there are no runs, and lists unreadable files', () => {
    const empty = renderIndexPage([]);
    expect(empty).toContain('No runs here yet');
    expect(empty).toContain('0 runs');
    const withProblem = renderIndexPage([], {
      problems: [{ file: 'bad.jsonl', message: 'Line 1: not valid JSON' }],
    });
    expect(withProblem).toContain('Files that could not be read');
    expect(withProblem).toContain('bad.jsonl');
  });
});
