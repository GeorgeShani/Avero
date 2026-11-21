import { workspaceRoles } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { canDecideRuns, canPushRuns } from './runs.ts';

describe('run permissions', () => {
  it('lets owners, admins and members push, and not viewers', () => {
    expect(workspaceRoles.filter((role) => canPushRuns(role))).toEqual([
      'owner',
      'admin',
      'member',
    ]);
  });

  it('lets only owners and admins decide', () => {
    expect(workspaceRoles.filter((role) => canDecideRuns(role))).toEqual(['owner', 'admin']);
  });
});
