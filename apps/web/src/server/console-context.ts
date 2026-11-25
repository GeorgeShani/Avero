import 'server-only';

import { writeLog } from '@avero/observability';
import { cookies } from 'next/headers';
import type { HostedState } from '../features/console-shell/hosted';
import { pickWorkspace, workspaceCookie } from '../features/console-shell/workspace-pick';
import { queryWorkspaces, workspaceSession } from './workspaces';

/** The workspace this browser last chose, if any. Only a hint: it is checked against membership. */
export async function rememberedWorkspace(): Promise<string | undefined> {
  return (await cookies()).get(workspaceCookie)?.value;
}

/** Remembers a workspace choice for a year. The id is only ever used after a membership check. */
export async function rememberWorkspace(id: string): Promise<void> {
  (await cookies()).set(workspaceCookie, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * What the shell shows about the team workspace. A failure here must not break the local pages, so
 * it reports the workspace as unavailable and logs the cause.
 */
export async function loadHostedState(): Promise<HostedState> {
  try {
    const session = await workspaceSession();
    if (session.status !== 'signed-in') return { status: session.status };
    const workspaces = await queryWorkspaces(session.userId);
    const selected = pickWorkspace(workspaces, await rememberedWorkspace());
    return {
      status: 'signed-in',
      workspaces: workspaces.map(({ id, name }) => ({ id, name })),
      selectedId: selected?.id,
    };
  } catch {
    writeLog('error', 'console.hosted_state_failed');
    return { status: 'unavailable' };
  }
}
