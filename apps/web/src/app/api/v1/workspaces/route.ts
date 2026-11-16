import {
  readWorkspaceInput,
  workspaceApiSession,
  workspaceJson,
} from '../../../../server/workspace-api';
import { addWorkspace, queryWorkspaces } from '../../../../server/workspaces';

export async function GET() {
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  return workspaceJson(await queryWorkspaces(session.userId));
}

export async function POST(request: Request) {
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  const input = await readWorkspaceInput(request);
  if (input instanceof Response) return input;
  return workspaceJson(await addWorkspace(session.userId, input.name), 201);
}
