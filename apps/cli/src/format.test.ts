import { describe, expect, it } from 'vitest';
import type { Verdict } from '@avero/contracts';
import { describeVerdict, formatCost, formatDuration, formatTokens } from './format.ts';

describe('formatDuration', () => {
  it('uses ms, seconds and minutes', () => {
    expect(formatDuration(240)).toBe('240 ms');
    expect(formatDuration(12_340)).toBe('12.3 s');
    expect(formatDuration(125_000)).toBe('2 min 5 s');
  });
});

describe('formatCost and formatTokens', () => {
  it('shows cents precisely, and says when the cost is not reported', () => {
    expect(formatCost(null)).toBe('not reported');
    expect(formatCost(1.5)).toBe('$0.015');
    expect(formatCost(250)).toBe('$2.50');
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(21_160)).toBe('21.2k');
  });
});

describe('describeVerdict', () => {
  const verdict: Verdict = {
    v: 1,
    runId: 'r1',
    summary: 'Retries, but the delay is fixed.',
    checks: [
      { id: 'c1', claim: 'Retries on failure', verdict: 'pass', evidence: 'loop in deliver.js' },
      { id: 'c2', claim: 'Backoff is exponential', verdict: 'fail', evidence: 'delay is 200 ms' },
      { id: 'c3', claim: 'Handles thrown errors', verdict: 'unclear', evidence: 'not in the diff' },
    ],
    outOfScope: [{ path: 'package.json', reason: 'the task did not ask for it' }],
    tests: { ran: true, passed: true, evidence: 'npm test exit 0' },
    risk: { tier: 'medium', reasons: ['A check failed.'] },
    reviewer: { model: 'composer-2.5', reviewedAt: '2026-11-20T11:00:00.000Z' },
    adjustments: ['Risk raised from low to medium: A check failed.'],
  };

  it('shows the risk, counts, each check with a mark, and what was outside the task', () => {
    const text = describeVerdict(verdict).join('\n');
    expect(text).toContain('Risk MEDIUM · 1 pass, 1 fail, 1 unclear · reviewed by composer-2.5');
    expect(text).toContain('✓ Retries on failure');
    expect(text).toContain('✕ Backoff is exponential');
    expect(text).toContain('? Handles thrown errors');
    expect(text).toContain('package.json: the task did not ask for it');
    expect(text).toContain('Tests: ran and passed.');
    expect(text).toContain('Avero corrected the reviewer');
  });

  it('leaves out the sections that are empty', () => {
    const text = describeVerdict({
      ...verdict,
      outOfScope: [],
      adjustments: [],
      risk: { tier: 'low', reasons: [] },
    }).join('\n');
    expect(text).not.toContain('Outside the task');
    expect(text).not.toContain('corrected');
  });
});
