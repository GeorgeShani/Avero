'use server';

import { workspaceIdSchema } from '@avero/contracts';
import { revalidatePath } from 'next/cache';
import { recordDecision, type DecisionResult } from '../../../../server/decisions';
import { workspaceRunSource } from '../../../../server/run-source';
import { canDecideRuns } from '../../../../server/tasks';
import { queryWorkspace, workspaceSession } from '../../../../server/workspaces';

/**
 * Records a decision on a run that belongs to a workspace. Who may decide is checked here, on the
 * server, against the person's role: the page hides the buttons, but this is the gate.
 */
export async function decideWorkspaceRun(
  workspaceId: string,
  runId: string,
  decision: string,
  note: string,
): Promise<DecisionResult> {
  const session = await workspaceSession();
  if (session.status !== 'signed-in') return { ok: false, error: 'Sign in to decide.' };
  const id = workspaceIdSchema.safeParse(workspaceId);
  if (!id.success) return { ok: false, error: 'There is no such workspace.' };
  const workspace = await queryWorkspace(session.userId, id.data);
  if (!workspace) return { ok: false, error: 'There is no such workspace.' };
  if (!canDecideRuns(workspace.role))
    return { ok: false, error: 'Only owners and admins can decide on runs.' };

  const result = await recordDecision(
    { runId, decision, note },
    { source: workspaceRunSource(workspace, { clerkUserId: session.userId }), readOnly: false },
  );
  if (result.ok) {
    revalidatePath('/tasks', 'layout');
    revalidatePath('/overview');
  }
  return result;
}
