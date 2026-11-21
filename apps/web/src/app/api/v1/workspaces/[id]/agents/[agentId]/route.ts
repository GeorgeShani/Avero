import { agentSchema } from '@avero/contracts';
import { deleteAgentDefinition } from '../../../../../../../server/task-api';
import { taskContext } from '../../../../../../../server/tasks';
import { workspaceJson } from '../../../../../../../server/workspace-api';

type Context = { params: Promise<{ id: string; agentId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const context = await taskContext(params);
  if (context instanceof Response) return context;
  const agentId = agentSchema.shape.id.safeParse((await params).agentId);
  if (!agentId.success) return workspaceJson({ error: 'Agent not found' }, 404);
  const result = await deleteAgentDefinition(context.deps, context.who, agentId.data);
  return workspaceJson(result.body, result.status);
}
