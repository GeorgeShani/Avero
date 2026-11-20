import { describe, expect, it } from 'vitest';
import { benchData } from './run-data';

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
