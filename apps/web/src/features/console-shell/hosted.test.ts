import { describe, expect, it } from 'vitest';
import { hostedBlocker, isWorkspacePath } from './hosted';

describe('isWorkspacePath', () => {
  it('is true for workspace pages and their children', () => {
    expect(isWorkspacePath('/tasks')).toBe(true);
    expect(isWorkspacePath('/workspaces/abc')).toBe(true);
  });

  it('is false for pages that read this machine', () => {
    expect(isWorkspacePath('/overview')).toBe(false);
    expect(isWorkspacePath('/runs/some-run')).toBe(false);
    expect(isWorkspacePath('/tasksfoo')).toBe(false);
  });
});

describe('hostedBlocker', () => {
  it('names what stands between the person and a workspace page', () => {
    expect(hostedBlocker({ status: 'unavailable' })).toBe('Setup');
    expect(hostedBlocker({ status: 'signed-out' })).toBe('Sign in');
    expect(hostedBlocker({ status: 'signed-in', workspaces: [] })).toBe('Create');
  });

  it('says nothing once a workspace exists', () => {
    expect(
      hostedBlocker({ status: 'signed-in', workspaces: [{ id: 'a', name: 'A' }], selectedId: 'a' }),
    ).toBeUndefined();
  });
});
