/**
 * What the console knows about the team workspace, for the shell. It never carries a secret or a
 * person's details beyond the names of workspaces they belong to.
 */
export type HostedState =
  /** The server has no sign-in or no database, so workspace pages cannot work here. */
  | { status: 'unavailable' }
  | { status: 'signed-out' }
  | {
      status: 'signed-in';
      workspaces: { id: string; name: string }[];
      selectedId?: string;
      /** Finished runs in the selected workspace that nobody has decided on. */
      toDecide: number;
    };

/** Pages whose data belongs to a workspace. Every other console page reads this machine. */
export const workspacePaths = [
  '/tasks',
  '/activity',
  '/repositories',
  '/agents',
  '/workspaces',
] as const;

export function isWorkspacePath(pathname: string): boolean {
  return workspacePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** The short word shown beside a workspace page in the sidebar when it cannot be used yet. */
export function hostedBlocker(state: HostedState): string | undefined {
  if (state.status === 'unavailable') return 'Setup';
  if (state.status === 'signed-out') return 'Sign in';
  if (state.workspaces.length === 0) return 'Create';
  return undefined;
}
