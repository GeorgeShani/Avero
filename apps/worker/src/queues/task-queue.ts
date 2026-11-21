import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const taskQueueName = 'avero-tasks';

export type TaskJob = { taskId: string };

export function createTaskQueue(connection: Redis, name: string = taskQueueName): Queue<TaskJob> {
  return new Queue<TaskJob>(name, {
    connection,
    defaultJobOptions: {
      // The task row is the record of what happened. Retries are the lifecycle's job (recovery),
      // not the queue's, so a failed job is not run again behind the database's back.
      attempts: 1,
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600, count: 1000 },
    },
  });
}

/**
 * Puts a task on the queue. The outbox row's id is the job id: handing the same row over twice
 * (a relay that crashed after publishing) leaves one job in the queue, not two.
 */
export async function enqueueTask(
  queue: Queue<TaskJob>,
  item: { taskId: string; outboxId: string },
): Promise<void> {
  await queue.add('run', { taskId: item.taskId }, { jobId: item.outboxId });
}
