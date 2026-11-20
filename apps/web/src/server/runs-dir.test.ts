import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRunsDir } from './runs-dir';

describe('resolveRunsDir', () => {
  it('uses AVERO_RUNS_DIR when it is set', () => {
    expect(resolveRunsDir('/app', { AVERO_RUNS_DIR: '/data/runs' }, () => false)).toBe(
      resolve('/data/runs'),
    );
  });

  it('prefers the server folder, then the workspace root two levels up', () => {
    const here = join('/repo', 'apps', 'web', '.avero', 'runs');
    const root = resolve('/repo/apps/web', '..', '..', '.avero', 'runs');
    expect(resolveRunsDir('/repo/apps/web', {}, (path) => path === here)).toBe(here);
    expect(resolveRunsDir('/repo/apps/web', {}, (path) => path === root)).toBe(root);
  });

  it('points at the server folder when no records exist yet', () => {
    expect(resolveRunsDir('/repo/apps/web', {}, () => false)).toBe(
      join('/repo/apps/web', '.avero', 'runs'),
    );
  });

  it('ignores a blank AVERO_RUNS_DIR', () => {
    expect(resolveRunsDir('/x', { AVERO_RUNS_DIR: '  ' }, () => false)).toBe(
      join('/x', '.avero', 'runs'),
    );
  });
});
