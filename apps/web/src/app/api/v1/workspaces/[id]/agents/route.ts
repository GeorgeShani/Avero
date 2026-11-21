import { createAgentDefinition, readAgents } from '../../../../../../server/task-api';
import { jsonBody, taskContext } from '../../../../../../server/tasks';
import { workspaceJson } from '../../../../../../server/workspace-api';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const context = await taskContext(params);
  if (context instanceof Response) return context;
  const result = await readAgents(context.deps, context.who);
  return workspaceJson(result.body, result.status);
}

export async function POST(request: Request, { params }: Context) {
  const context = await taskContext(params);
  if (context instanceof Response) return context;
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const result = await createAgentDefinition(context.deps, context.who, body);
  return workspaceJson(result.body, result.status);
}
