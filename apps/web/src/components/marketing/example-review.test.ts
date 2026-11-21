import { checkCounts, configMetrics } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { exampleBench, reviewedGood, reviewedRisky } from './example-review';

describe('example reviews', () => {
  it('are real verdicts that parse', () => {
    expect(reviewedGood.verdict.risk.tier).toBe('low');
    expect(checkCounts(reviewedGood.verdict).fail).toBe(0);
    expect(reviewedGood.verdict.adjustments).toEqual([]);
  });

  it('keep the correction Avero made to the reviewer on the cancelled run', () => {
    expect(reviewedRisky.verdict.risk.tier).toBe('high');
    expect(reviewedRisky.verdict.adjustments.join(' ')).toMatch(/raised from medium to high/);
    expect(reviewedRisky.status).toBe('CANCELLED');
  });
});

describe('example bench', () => {
  it('is a small real result whose numbers come from its cells', () => {
    const { result, tasks } = exampleBench;
    expect(tasks.length).toBe(2);
    expect(result.cells.length).toBe(4);
    for (const config of result.configs) {
      const metrics = configMetrics(result, config.id);
      expect(metrics.attempts).toBe(2);
      expect(metrics.resolved).toBe(
        result.cells.filter((cell) => cell.configId === config.id && cell.outcome === 'resolved')
          .length,
      );
    }
  });
});
