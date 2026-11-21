import type { Workspace } from '@avero/contracts';
import { signInstallState, verifyInstallState } from '@avero/github';
import { canManageRepositories } from '@avero/security';

type Deps = {
  stateSecret: string;
  appSlug: string;
  findWorkspace: (userId: string, workspaceId: string) => Promise<Workspace | undefined>;
};

export type InstallStart =
  { status: 302; location: string } | { status: 403 | 404; body: { error: string } };

/**
 * Starts installing the GitHub App for a workspace: only an owner or admin of that workspace may,
 * and the redirect to GitHub carries a signed state naming the workspace and the person.
 */
export async function startInstall(
  input: { userId: string; workspaceId: string },
  deps: Deps,
  now?: () => number,
): Promise<InstallStart> {
  const workspace = await deps.findWorkspace(input.userId, input.workspaceId);
  if (!workspace) return { status: 404, body: { error: 'Workspace not found' } };
  if (!canManageRepositories(workspace.role))
    return { status: 403, body: { error: 'Only owners and admins can connect GitHub' } };
  const state = signInstallState(deps.stateSecret, {
    workspaceId: workspace.id,
    userId: input.userId,
    ...(now ? { now } : {}),
  });
  return {
    status: 302,
    location: `https://github.com/apps/${deps.appSlug}/installations/new?state=${encodeURIComponent(state)}`,
  };
}

export type InstallCallback =
  { status: 302; location: string } | { status: 400 | 403 | 502; body: { error: string } };

/**
 * GitHub sends the person back here after they install. The state must be one this server signed,
 * for this same signed-in person, and that person must still manage the workspace. Then the
 * installation is linked to it and its repositories are listed from GitHub, never taken from the
 * query string.
 */
export async function finishInstall(
  input: { userId: string; installationId: string | null; state: string | null },
  deps: Deps & {
    link: (workspaceId: string, installationId: number) => Promise<void>;
    syncRepositories: (workspaceId: string, installationId: number) => Promise<void>;
  },
  now?: () => number,
): Promise<InstallCallback> {
  const id = Number(input.installationId);
  if (!input.state || !Number.isInteger(id) || id <= 0)
    return { status: 400, body: { error: 'The installation response is incomplete' } };
  const verified = verifyInstallState(deps.stateSecret, input.state, {
    userId: input.userId,
    ...(now ? { now } : {}),
  });
  if (!verified)
    return {
      status: 400,
      body: { error: 'This install link is invalid or has expired. Start again.' },
    };

  const workspace = await deps.findWorkspace(input.userId, verified.workspaceId);
  if (!workspace || !canManageRepositories(workspace.role))
    return { status: 403, body: { error: 'You no longer manage that workspace' } };

  try {
    await deps.link(workspace.id, id);
    await deps.syncRepositories(workspace.id, id);
  } catch {
    // A conflict (the installation belongs to another workspace) and a GitHub failure look the
    // same to the person, and neither says anything about other workspaces.
    return { status: 502, body: { error: 'Could not connect that installation' } };
  }
  return { status: 302, location: '/repositories' };
}
