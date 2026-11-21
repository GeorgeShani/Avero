import { taskSchema } from '@avero/contracts';
import { readTask, taskEventStream } from '../../../../../../../../server/task-api';
import { taskContext } from '../../../../../../../../server/tasks';
import { workspaceJson } from '../../../../../../../../server/workspace-api';

type Context = { params: Promise<{ id: string; taskId: string }> };

export const dynamic = 'force-dynamic';

/** Follows a task live as server-sent events. Resume with ?after=<seq> or Last-Event-ID. */
export async function GET(request: Request, { params }: Context) {
  const context = await taskContext(params);
  if (context instanceof Response) return context;
  const taskId = taskSchema.shape.id.safeParse((await params).taskId);
  if (!taskId.success) return workspaceJson({ error: 'Task not found' }, 404);

  // Check the person may see this task before anything is streamed.
  const found = await readTask(context.deps, context.who, taskId.data);
  if (found.status !== 200) return workspaceJson(found.body, found.status);

  const url = new URL(request.url);
  const resume = Number(
    url.searchParams.get('after') ?? request.headers.get('last-event-id') ?? -1,
  );
  const after = Number.isInteger(resume) && resume >= -1 ? resume : -1;

  const encoder = new TextEncoder();
  const stream = taskEventStream(context.deps, context.who.workspaceId, taskId.data, {
    after,
    signal: request.signal,
  });
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await stream.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
    async cancel() {
      await stream.return(undefined);
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
