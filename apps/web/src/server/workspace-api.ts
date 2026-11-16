import 'server-only';
import { workspaceInputSchema } from '@avero/contracts';
import { workspaceSession } from './workspaces';

export function workspaceJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function workspaceApiSession() {
  const session = await workspaceSession();
  if (session.status === 'unavailable')
    return workspaceJson({ error: 'Workspace service unavailable' }, 503);
  if (session.status === 'signed-out') return workspaceJson({ error: 'Sign-in required' }, 401);
  return session;
}

export async function readWorkspaceInput(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json')
    return workspaceJson({ error: 'Expected application/json' }, 415);

  const input = workspaceInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return workspaceJson({ error: 'Enter a workspace name between 1 and 80 characters' }, 400);
  return input.data;
}
