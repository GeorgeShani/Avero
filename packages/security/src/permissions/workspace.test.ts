import { workspaceRoles } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { canEditWorkspace, workspaceEditors } from './workspace.ts';

describe('canEditWorkspace', () => {
  it('lets only owners and admins edit', () => {
    const allowed = workspaceRoles.filter((role) => canEditWorkspace(role));
    expect(allowed).toEqual(['owner', 'admin']);
    expect(workspaceEditors).toEqual(['owner', 'admin']);
  });

  it.each(['member', 'viewer'] as const)('denies the %s role', (role) => {
    expect(canEditWorkspace(role)).toBe(false);
  });
});
