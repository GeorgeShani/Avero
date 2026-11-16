import { workspaceIdSchema } from '@avero/contracts';
import {
  readWorkspaceInput,
  workspaceApiSession,
  workspaceJson,
} from '../../../../../server/workspace-api';
import { queryWorkspace, updateWorkspace } from '../../../../../server/workspaces';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  const id = workspaceIdSchema.safeParse((await params).id);
  if (!id.success) return workspaceJson({ error: 'Workspace not found' }, 404);
  const workspace = await queryWorkspace(session.userId, id.data);
  return workspace
    ? workspaceJson(workspace)
    : workspaceJson({ error: 'Workspace not found' }, 404);
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  const id = workspaceIdSchema.safeParse((await params).id);
  if (!id.success) return workspaceJson({ error: 'Workspace not found' }, 404);
  const input = await readWorkspaceInput(request);
  if (input instanceof Response) return input;
  const updated = await updateWorkspace(session.userId, id.data, input.name);
  return updated
    ? new Response(null, { status: 204 })
    : workspaceJson({ error: 'Workspace not found' }, 404);
}
