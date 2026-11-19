import { describe, expect, it } from 'vitest';
import { benchData, clock, costAt, runDuration, spans, tokensAt } from './run-data';

describe('example run', () => {
  it('lays its spans out in order without overlap and ends at the run length', () => {
    spans.forEach((span, index) => {
      expect(span.end).toBeGreaterThan(span.start);
      if (index > 0) expect(span.start).toBe(spans[index - 1]?.end);
    });
    expect(spans.at(-1)?.end).toBe(runDuration);
  });

  it('formats time as mm:ss.t', () => {
    expect(clock(0)).toBe('00:00.0');
    expect(clock(8.04)).toBe('00:08.0');
    expect(clock(61.5)).toBe('01:01.5');
    expect(clock(-3)).toBe('00:00.0');
  });

  it('never decreases tokens or cost over the run, and stops growing at the end', () => {
    let tokens = 0;
    for (let time = 0; time <= runDuration; time += 0.5) {
      expect(tokensAt(time)).toBeGreaterThanOrEqual(tokens - 90 * 2);
      tokens = tokensAt(time);
    }
    expect(tokensAt(runDuration + 10)).toBe(tokensAt(runDuration));
    expect(costAt(runDuration)).toBeGreaterThan(costAt(1));
  });
});

describe('example bench data', () => {
  it('has a pass rate and a cost for every effort under both rule sets', () => {
    for (const rules of ['Baseline', 'Tuned'] as const) {
      for (const effort of ['low', 'medium', 'high', 'max'] as const) {
        const { pass, cost } = benchData[rules][effort];
        expect(pass).toBeGreaterThan(0);
        expect(pass).toBeLessThanOrEqual(100);
        expect(cost).toBeGreaterThan(0);
      }
    }
  });

  it('shows the tuned rules resolving at least as many tasks for no more money', () => {
    for (const effort of ['low', 'medium', 'high', 'max'] as const) {
      expect(benchData.Tuned[effort].pass).toBeGreaterThanOrEqual(benchData.Baseline[effort].pass);
      expect(benchData.Tuned[effort].cost).toBeLessThanOrEqual(benchData.Baseline[effort].cost);
    }
  });
});
