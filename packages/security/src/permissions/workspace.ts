import type { WorkspaceRole } from '@avero/contracts';

export const workspaceEditors = ['owner', 'admin'] as const satisfies readonly WorkspaceRole[];

export function canEditWorkspace(role: WorkspaceRole): boolean {
  return workspaceEditors.some((editor) => editor === role);
}
