import { workspaceRoles } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { canLaunchTasks, canManageAgents, canManageRepositories } from './tasks.ts';

describe('task permissions', () => {
  it('lets owners, admins and members launch tasks, and not viewers', () => {
    expect(workspaceRoles.filter((role) => canLaunchTasks(role))).toEqual([
      'owner',
      'admin',
      'member',
    ]);
  });

  it('lets only owners and admins register repositories', () => {
    expect(workspaceRoles.filter((role) => canManageRepositories(role))).toEqual([
      'owner',
      'admin',
    ]);
  });

  it('lets only owners and admins manage agent definitions', () => {
    expect(workspaceRoles.filter((role) => canManageAgents(role))).toEqual(['owner', 'admin']);
  });
});
