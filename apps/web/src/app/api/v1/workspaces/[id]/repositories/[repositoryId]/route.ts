import { repositorySchema } from '@avero/contracts';
import { deleteRepository } from '../../../../../../../server/task-api';
import { taskContext } from '../../../../../../../server/tasks';
import { workspaceJson } from '../../../../../../../server/workspace-api';

type Context = { params: Promise<{ id: string; repositoryId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const context = await taskContext(params);
  if (context instanceof Response) return context;
  const repositoryId = repositorySchema.shape.id.safeParse((await params).repositoryId);
  if (!repositoryId.success) return workspaceJson({ error: 'Repository not found' }, 404);
  const result = await deleteRepository(context.deps, context.who, repositoryId.data);
  return workspaceJson(result.body, result.status);
}
