import { describe, expect, it } from 'vitest';
import { formatCost, formatDuration, formatTokens } from './format.ts';

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
