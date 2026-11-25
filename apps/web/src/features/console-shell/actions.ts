'use server';

import { workspaceIdSchema } from '@avero/contracts';
import { rememberWorkspace } from '../../server/console-context';
import { queryWorkspaces, workspaceSession } from '../../server/workspaces';

/**
 * Makes a workspace the one the console shows. Only a workspace the signed-in person belongs to is
 * accepted, so a forged id does nothing. The page re-renders with the new choice.
 */
export async function selectWorkspaceAction(id: string): Promise<void> {
  const session = await workspaceSession();
  if (session.status !== 'signed-in') return;
  const parsed = workspaceIdSchema.safeParse(id);
  if (!parsed.success) return;
  const workspaces = await queryWorkspaces(session.userId);
  if (!workspaces.some((item) => item.id === parsed.data)) return;
  await rememberWorkspace(parsed.data);
}
