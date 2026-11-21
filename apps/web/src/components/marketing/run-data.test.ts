import { describe, expect, it } from 'vitest';
import { cheapestSetup, setups } from './bench-data';
import { phases } from './run-data';

describe('the bench example', () => {
  it('has the two setups of the real result, each with two attempts', () => {
    expect(setups.map((setup) => setup.label)).toEqual(['No rules file', 'With rules file']);
    for (const setup of setups) expect(setup.attempts).toBe(2);
  });

  it('picks the setup that spent the fewest tokens per resolved task', () => {
    const best = cheapestSetup();
    for (const setup of setups) {
      expect(best?.tokensPerResolved ?? Infinity).toBeLessThanOrEqual(
        setup.tokensPerResolved ?? Infinity,
      );
    }
  });

  it('has no cheapest setup when nothing was resolved', () => {
    expect(
      cheapestSetup(setups.map((setup) => ({ ...setup, tokensPerResolved: null }))),
    ).toBeNull();
  });
});

describe('the roadmap', () => {
  it('lists the six phases in order, with a state each', () => {
    expect(phases.map((phase) => phase.id)).toEqual(['0', '1', '2', '3', '4', '5']);
    for (const phase of phases) expect(phase.state).not.toBe('');
  });
});
