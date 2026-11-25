import { describe, expect, it } from 'vitest';
import { easeInOutQuart, easeOutExpo, splitWords, stepFor } from './motion';

describe('easing', () => {
  it('starts at nothing and ends at everything', () => {
    expect(easeOutExpo(0)).toBeCloseTo(0, 2);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeInOutQuart(0)).toBe(0);
    expect(easeInOutQuart(1)).toBe(1);
  });

  it('never goes backwards', () => {
    for (const ease of [easeOutExpo, easeInOutQuart]) {
      let last = -1;
      for (let i = 0; i <= 100; i++) {
        const value = ease(i / 100);
        expect(value).toBeGreaterThanOrEqual(last);
        last = value;
      }
    }
  });

  it('is fast early for ease-out and slow at both ends for ease-in-out', () => {
    expect(easeOutExpo(0.2)).toBeGreaterThan(0.7);
    expect(easeInOutQuart(0.1)).toBeLessThan(0.01);
    expect(easeInOutQuart(0.9)).toBeGreaterThan(0.99);
    expect(easeInOutQuart(0.5)).toBeCloseTo(0.5, 5);
  });

  it('clamps input outside 0 to 1', () => {
    expect(easeInOutQuart(-3)).toBe(0);
    expect(easeInOutQuart(7)).toBe(1);
  });
});

describe('splitWords', () => {
  it('splits on any run of whitespace and drops empties', () => {
    expect(splitWords('  One run in,\n a  complete record out. ')).toEqual([
      'One',
      'run',
      'in,',
      'a',
      'complete',
      'record',
      'out.',
    ]);
    expect(splitWords('')).toEqual([]);
  });
});

describe('stepFor', () => {
  it('maps progress onto whole steps and caps at the maximum', () => {
    expect(stepFor(0, 10, 8)).toBe(0);
    expect(stepFor(0.5, 10, 8)).toBe(5);
    expect(stepFor(0.99, 10, 8)).toBe(8);
    expect(stepFor(1, 10, 8)).toBe(8);
  });

  it('ignores progress outside 0 to 1', () => {
    expect(stepFor(-1, 10, 8)).toBe(0);
    expect(stepFor(4, 10, 8)).toBe(8);
  });
});
