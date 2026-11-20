import type { BenchCell, BenchResult } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { describeBench, parsePrices } from './bench-format.ts';

const cell = (
  configId: string,
  taskId: string,
  outcome: BenchCell['outcome'],
  tokens = 1000,
): BenchCell => ({
  taskId,
  configId,
  repeat: 0,
  outcome,
  testsExitCode: outcome === 'resolved' ? 0 : 1,
  testsOutput: '',
  costCents: null,
  durationMs: 10_000,
  usage: {
    inputTokens: tokens,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: tokens,
  },
});

const result: BenchResult = {
  v: 1,
  id: 'r1',
  suiteId: 's',
  startedAt: '2026-11-21T10:00:00.000Z',
  repeats: 1,
  configs: [
    { id: 'base', label: 'composer-2.5', model: 'composer-2.5', rules: [] },
    { id: 'rules', label: 'composer-2.5 + AGENTS.md', model: 'composer-2.5', rules: [] },
  ],
  cells: [
    cell('base', 't1', 'resolved'),
    cell('base', 't2', 'unresolved', 3000),
    cell('rules', 't1', 'resolved'),
    cell('rules', 't2', 'resolved', 2000),
  ],
};

describe('parsePrices', () => {
  it('reads dollars per million for input, output and optional cached input', () => {
    expect(parsePrices(['composer-2.5=0.5,2.5', 'other=1,5,0.1'])).toEqual({
      'composer-2.5': { inputPerMillion: 0.5, outputPerMillion: 2.5 },
      other: { inputPerMillion: 1, outputPerMillion: 5, cacheReadPerMillion: 0.1 },
    });
  });

  it('says what is wrong with a price it cannot read', () => {
    expect(parsePrices(['composer-2.5'])).toContain('Could not read');
    expect(parsePrices(['m=a,b'])).toContain('Could not read');
    expect(parsePrices(['m=-1,2'])).toContain('Could not read');
  });
});

describe('describeBench', () => {
  const text = describeBench(result, undefined).join('\n');

  it('shows each setup with its resolved count, pass rate and range', () => {
    expect(text).toContain('composer-2.5 + AGENTS.md');
    expect(text).toMatch(/1\/2\s+50% \(\d+%–\d+%\)/);
    expect(text).toMatch(/2\/2\s+100% \(/);
  });

  it('counts the failed attempt in the tokens per resolved task', () => {
    // base: 4000 tokens for 1 resolved task; rules: 3000 for 2.
    expect(text).toContain('4000');
    expect(text).toContain('1500');
  });

  it('says cost is unknown without billing or prices, and estimates when given prices', () => {
    expect(text).toContain('unknown');
    const priced = describeBench(result, undefined, {
      'composer-2.5': { inputPerMillion: 1000, outputPerMillion: 0 },
    }).join('\n');
    expect(priced).toContain('(estimated)');
  });

  it('marks each task per setup, and warns that few attempts make a weak result', () => {
    expect(text).toContain('✓  ✓');
    expect(text).toContain('✕  ✓');
    expect(text).toContain('only 2 attempts per setup');
  });

  it('flags attempts that could not be judged', () => {
    const withError: BenchResult = {
      ...result,
      cells: [...result.cells, cell('base', 't3', 'error')],
    };
    expect(describeBench(withError, undefined).join('\n')).toContain('could not be judged');
  });
});
