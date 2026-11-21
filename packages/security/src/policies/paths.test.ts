import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pathWithinRoots } from './paths.ts';

const root = resolve('/work/repos');

describe('pathWithinRoots', () => {
  it('accepts a root and anything inside it', () => {
    expect(pathWithinRoots(root, [root])).toBe(true);
    expect(pathWithinRoots(resolve(root, 'demo'), [root])).toBe(true);
    expect(pathWithinRoots(resolve(root, 'a', 'b'), [root])).toBe(true);
  });

  it('refuses parents, siblings that share a prefix, and ..', () => {
    expect(pathWithinRoots(resolve('/work'), [root])).toBe(false);
    expect(pathWithinRoots(`${root}-evil`, [root])).toBe(false);
    expect(pathWithinRoots(`${root}/../secrets`, [root])).toBe(false);
  });

  it('refuses relative paths and has nothing to allow without roots', () => {
    expect(pathWithinRoots('repos/demo', [root])).toBe(false);
    expect(pathWithinRoots(resolve(root, 'demo'), [])).toBe(false);
    expect(pathWithinRoots(resolve(root, 'demo'), ['repos'])).toBe(false);
  });

  it('accepts a path inside any of several roots', () => {
    const other = resolve('/srv/code');
    expect(pathWithinRoots(resolve(other, 'x'), [root, other])).toBe(true);
  });
});
