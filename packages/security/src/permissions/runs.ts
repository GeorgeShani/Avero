import type { WorkspaceRole } from '@avero/contracts';

/** Roles that may push runs and bench results into a workspace. A viewer can only read. */
export const runWriters = ['owner', 'admin', 'member'] as const satisfies readonly WorkspaceRole[];

export function canPushRuns(role: WorkspaceRole): boolean {
  return runWriters.some((writer) => writer === role);
}

/** Roles that may record a decision on a run. Deciding is a review act: members and viewers read. */
export const runDeciders = ['owner', 'admin'] as const satisfies readonly WorkspaceRole[];

export function canDecideRuns(role: WorkspaceRole): boolean {
  return runDeciders.some((decider) => decider === role);
}
