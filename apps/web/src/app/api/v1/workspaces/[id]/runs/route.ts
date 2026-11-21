import { maxRunPushLength, workspaceIdSchema } from '@avero/contracts';
import { pushRun } from '../../../../../../server/run-push';
import { workspaceApiSession, workspaceJson } from '../../../../../../server/workspace-api';
import { queryWorkspace, storeRun } from '../../../../../../server/workspaces';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  const id = workspaceIdSchema.safeParse((await params).id);
  if (!id.success) return workspaceJson({ error: 'Workspace not found' }, 404);

  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json')
    return workspaceJson({ error: 'Expected application/json' }, 415);
  // The record travels as text inside the JSON, so the body is a little larger than the record.
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > maxRunPushLength + 100_000)
    return workspaceJson({ error: 'The run is too large to push' }, 413);

  const result = await pushRun(
    {
      userId: session.userId,
      workspaceId: id.data,
      body: await request.json().catch(() => null),
    },
    { findWorkspace: queryWorkspace, save: storeRun },
  );
  return workspaceJson(result.body, result.status);
}
