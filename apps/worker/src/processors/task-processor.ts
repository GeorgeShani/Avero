import { claimTask } from '@avero/db';
import { writeLog } from '@avero/observability';
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
  await runTask(claimed, deps);
  return 'ran';
}
