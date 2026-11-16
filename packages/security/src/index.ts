export function redactSecrets(text: string, secrets: readonly string[]): string {
  const values = [...new Set(secrets.filter(Boolean))].sort(
    (left, right) => right.length - left.length,
  );
  if (values.length === 0) return text;

  return text.replace(
    new RegExp(values.map((value) => RegExp.escape(value)).join('|'), 'g'),
    '[redacted]',
  );
}
import type { WorkspaceRole } from '@avero/contracts';

export const workspaceEditors = ['owner', 'admin'] as const satisfies readonly WorkspaceRole[];

export function canEditWorkspace(role: WorkspaceRole): boolean {
  return workspaceEditors.some((editor) => editor === role);
}
