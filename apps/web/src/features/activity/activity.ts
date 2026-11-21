import type { Task } from '@avero/contracts';

export type ActivityItem = {
  at: string;
  taskId: string;
  kind: 'launched' | 'started' | 'finished' | 'failed' | 'cancelled';
  /** What the task was asked to do, cut short. */
  prompt: string;
  detail?: string;
  runId?: string;
};

const short = (text: string) => (text.length > 120 ? `${text.slice(0, 117)}…` : text);

/**
 * A workspace's activity, newest first, worked out from its tasks: when each was launched, when
 * it started and how it ended. It shows what the task records hold and nothing else: there is no
 * separate audit log yet, so it does not show who did it or anything else a person did.
 */
export function taskActivity(tasks: readonly Task[], limit = 100): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const task of tasks) {
    const base = { taskId: task.id, prompt: short(task.prompt) };
    items.push({ ...base, at: task.createdAt, kind: 'launched' });
    if (task.startedAt) items.push({ ...base, at: task.startedAt, kind: 'started' });
    if (task.finishedAt && ['finished', 'failed', 'cancelled'].includes(task.status)) {
      items.push({
        ...base,
        at: task.finishedAt,
        kind: task.status as 'finished' | 'failed' | 'cancelled',
        ...(task.error ? { detail: task.error } : {}),
        ...(task.runId ? { runId: task.runId } : {}),
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
