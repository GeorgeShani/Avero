import { describe, expect, it } from 'vitest';
import { assessChange } from './assess-change.ts';

describe('change assessment', () => {
  it('returns unique review paths for manifests, lockfiles, and workflows', () => {
    expect(
      assessChange([
        'apps/web/package.json',
        'pnpm-lock.yaml',
        '.github/workflows/ci.yml',
        'apps/web/package.json',
        'README.md',
      ]),
    ).toEqual({
      verdict: 'Dependency or workflow review required',
      reviewPaths: ['apps/web/package.json', 'pnpm-lock.yaml', '.github/workflows/ci.yml'],
    });
  });

  it('gives a standard review for source and documentation changes', () => {
    expect(assessChange(['apps/web/src/page.tsx', 'README.md'])).toEqual({
      verdict: 'Standard review',
      reviewPaths: [],
    });
  });
});
