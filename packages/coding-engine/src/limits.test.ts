import { describe, expect, it } from 'vitest';
import { limitReason, sumUsage } from './limits.ts';

describe('limitReason', () => {
  it('is undefined with no limits, or while within them', () => {
    expect(limitReason(undefined, { tokens: 1e9, elapsedMs: 1e9 })).toBeUndefined();
    expect(limitReason({}, { tokens: 1e9, elapsedMs: 1e9 })).toBeUndefined();
    expect(
      limitReason({ maxTokens: 1000, maxSeconds: 60 }, { tokens: 999, elapsedMs: 59_999 }),
    ).toBeUndefined();
  });

  it('names the token cap when it is reached', () => {
    expect(limitReason({ maxTokens: 1000 }, { tokens: 1000, elapsedMs: 0 })).toContain(
      'Token cap reached: 1,000 tokens used',
    );
  });

  it('names the time cap when it is reached', () => {
    expect(limitReason({ maxSeconds: 30 }, { tokens: 0, elapsedMs: 31_500 })).toContain(
      'Time cap reached: 31.5 s elapsed, the cap is 30 s.',
    );
  });

  it('reports the token cap first when both are over', () => {
    expect(
      limitReason({ maxTokens: 10, maxSeconds: 1 }, { tokens: 50, elapsedMs: 5000 }),
    ).toContain('Token cap');
  });
});

describe('sumUsage', () => {
  const usage = (n: number, reasoning?: number) => ({
    inputTokens: n,
    outputTokens: n,
    cacheReadTokens: n,
    cacheWriteTokens: n,
    totalTokens: n * 4,
    ...(reasoning !== undefined ? { reasoningTokens: reasoning } : {}),
  });

  it('adds every field, and skips turns with no usage', () => {
    expect(sumUsage([usage(1), undefined, usage(2)])).toEqual(usage(3));
  });

  it('keeps reasoning tokens only when some turn reported them', () => {
    expect(sumUsage([usage(1, 5), usage(1)])?.reasoningTokens).toBe(5);
    expect(sumUsage([usage(1), usage(1)])).not.toHaveProperty('reasoningTokens');
  });

  it('is undefined when nothing reported usage', () => {
    expect(sumUsage([undefined, undefined])).toBeUndefined();
    expect(sumUsage([])).toBeUndefined();
  });
});
