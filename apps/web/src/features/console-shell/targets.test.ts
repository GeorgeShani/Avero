import { describe, expect, it } from 'vitest';
import type { HostedState } from './hosted';
import { buildTargets } from './targets';

const pages = [
  { label: 'Overview', href: '/overview' },
  { label: 'Tasks', href: '/tasks' },
];

function build(hosted: HostedState, theme: 'system' | 'light' | 'dark' = 'system') {
  return buildTargets({
    pages,
    suiteIds: ['s1'],
    recent: [{ id: 'run-1', task: 'Fix it' }],
    hosted,
    theme,
  });
}

const ids = (targets: ReturnType<typeof build>) => targets.map((target) => target.id);

describe('buildTargets', () => {
  it('lists pages before actions before suites and runs', () => {
    const list = ids(build({ status: 'unavailable' }));
    expect(list.indexOf('page:/overview')).toBeLessThan(list.indexOf('action:machine'));
    expect(list.indexOf('action:machine')).toBeLessThan(list.indexOf('suite:s1'));
    expect(list.indexOf('suite:s1')).toBeLessThan(list.indexOf('run:run-1'));
  });

  it('leaves out the launch and workspace actions when there is no workspace to use', () => {
    const list = ids(build({ status: 'signed-out' }));
    expect(list).not.toContain('action:launch');
    expect(list.some((id) => id.startsWith('workspace:'))).toBe(false);
  });

  it('offers to launch a task and to switch to the workspaces that are not shown', () => {
    const list = ids(
      build({
        status: 'signed-in',
        workspaces: [
          { id: 'a', name: 'Alpha' },
          { id: 'b', name: 'Beta' },
        ],
        selectedId: 'a',
        toDecide: 0,
      }),
    );
    expect(list).toContain('action:launch');
    expect(list).toContain('workspace:b');
    expect(list).not.toContain('workspace:a');
  });

  it('offers the two themes that are not already in use', () => {
    const list = ids(build({ status: 'unavailable' }, 'dark'));
    expect(list).toContain('theme:system');
    expect(list).toContain('theme:light');
    expect(list).not.toContain('theme:dark');
  });

  it('shortens a long task to one line and keeps the run id as the hint', () => {
    const [run] = buildTargets({
      pages: [],
      suiteIds: [],
      recent: [{ id: 'run-9', task: 'x'.repeat(100) }],
      hosted: { status: 'unavailable' },
      theme: 'light',
    }).filter((target) => target.id === 'run:run-9');
    expect(run?.label.length).toBe(71);
    expect(run?.hint).toBe('run-9');
  });
});
