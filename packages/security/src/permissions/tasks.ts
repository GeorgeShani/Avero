import type { WorkspaceRole } from '@avero/contracts';

/** Roles that may launch and cancel tasks. A viewer can watch them. */
export const taskLaunchers = [
  'owner',
  'admin',
  'member',
] as const satisfies readonly WorkspaceRole[];

export function canLaunchTasks(role: WorkspaceRole): boolean {
  return taskLaunchers.some((launcher) => launcher === role);
}

/**
 * Roles that may register a repository, which decides which folders on the worker's machine an
 * agent can be pointed at. That is a decision about the machine, so only owners and admins.
 */
export const repositoryManagers = ['owner', 'admin'] as const satisfies readonly WorkspaceRole[];

export function canManageRepositories(role: WorkspaceRole): boolean {
  return repositoryManagers.some((manager) => manager === role);
}

/**
 * Roles that may create or delete agent definitions. The rules of a definition steer every task
 * launched with it, so, like repositories, they are for owners and admins.
 */
export function canManageAgents(role: WorkspaceRole): boolean {
  return repositoryManagers.some((manager) => manager === role);
}
