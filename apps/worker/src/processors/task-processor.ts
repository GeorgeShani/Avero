import { claimTask } from '@avero/db';
import { recordTaskSettled, withSpan, writeLog } from '@avero/observability';
import { runTask, type RunTaskDeps } from '../orchestration/index.ts';

/**
 * What a queue job does: take the task, and run it if this worker got it. A job for a task that is
 * not queued any more (a duplicate, a task cancelled while it waited, one another worker took)
 * does nothing, which is what makes a repeated job harmless.
 */
export async function processTask(taskId: string, deps: RunTaskDeps): Promise<'ran' | 'skipped'> {
  const claimed = await claimTask(deps.db, taskId);
  if (!claimed) {
    writeLog('info', 'task.skipped', { taskId });
    return 'skipped';
  }
  writeLog('info', 'task.started', { taskId, attempt: claimed.attempt });
  const startedAt = Date.now();
  await withSpan('task.process', { taskId, attempt: claimed.attempt }, async (span) => {
    const outcome = await runTask(claimed, deps);
    span.setAttribute('task.status', outcome.status);
    recordTaskSettled(outcome.status, Date.now() - startedAt);
  });
  return 'ran';
}
