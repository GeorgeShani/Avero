import { taskSchema } from '@avero/contracts';
import { stopTask } from '../../../../../../../../server/task-api';
import { taskContext } from '../../../../../../../../server/tasks';
import { workspaceJson } from '../../../../../../../../server/workspace-api';

type Context = { params: Promise<{ id: string; taskId: string }> };

export async function POST(_request: Request, { params }: Context) {
  const context = await taskContext(params);
  if (context instanceof Response) return context;
  const taskId = taskSchema.shape.id.safeParse((await params).taskId);
  if (!taskId.success) return workspaceJson({ error: 'Task not found' }, 404);
  const result = await stopTask(context.deps, context.who, taskId.data);
  return workspaceJson(result.body, result.status);
}
