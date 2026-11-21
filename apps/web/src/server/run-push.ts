import {
  decisionSchema,
  parseRunRecord,
  runPushSchema,
  verdictSchema,
  type RunPushed,
  type Workspace,
} from '@avero/contracts';
import { canPushRuns } from '@avero/security';

export type PushResult =
  { status: 201 | 200; body: RunPushed } | { status: 400 | 403 | 404; body: { error: string } };

/**
 * Decides whether a signed-in person may put a run in a workspace, checks what they sent, and saves
 * it. A workspace the person is not a member of answers 404, the same as one that does not exist,
 * so nobody can probe for workspace ids. Storage is injected so the rules are testable without a
 * database.
 */
export async function pushRun(
  input: { userId: string; workspaceId: string; body: unknown },
  deps: {
    findWorkspace: (userId: string, id: string) => Promise<Workspace | undefined>;
    save: (
      workspaceId: string,
      data: { record: string; verdict?: unknown; decision?: unknown },
      userId: string,
    ) => Promise<RunPushed>;
  },
): Promise<PushResult> {
  const workspace = await deps.findWorkspace(input.userId, input.workspaceId);
  if (!workspace) return { status: 404, body: { error: 'Workspace not found' } };
  if (!canPushRuns(workspace.role))
    return { status: 403, body: { error: 'Your role in this workspace cannot push runs' } };

  const parsed = runPushSchema.safeParse(input.body);
  if (!parsed.success)
    return { status: 400, body: { error: 'Send { record, verdict?, decision? } as JSON' } };
  const { record, verdict, decision } = parsed.data;

  let runId: string;
  try {
    runId = parseRunRecord(record).started.runId;
  } catch {
    return { status: 400, body: { error: 'The record is not a valid Avero run record' } };
  }
  if (verdict !== undefined) {
    const checked = verdictSchema.safeParse(verdict);
    if (!checked.success) return { status: 400, body: { error: 'The verdict is not valid' } };
    if (checked.data.runId !== runId)
      return { status: 400, body: { error: 'The verdict is for a different run' } };
  }
  if (decision !== undefined) {
    const checked = decisionSchema.safeParse(decision);
    if (!checked.success) return { status: 400, body: { error: 'The decision is not valid' } };
    if (checked.data.runId !== runId)
      return { status: 400, body: { error: 'The decision is for a different run' } };
  }

  const saved = await deps.save(workspace.id, { record, verdict, decision }, input.userId);
  return { status: saved.created ? 201 : 200, body: saved };
}
