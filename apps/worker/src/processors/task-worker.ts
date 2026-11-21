import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { RunTaskDeps } from '../orchestration/index.ts';
import { taskQueueName, type TaskJob } from '../queues/index.ts';
import { processTask } from './task-processor.ts';

/** The queue consumer. Each job is one task; `concurrency` runs that many at once. */
export function createTaskWorker(
  connection: Redis,
  deps: RunTaskDeps,
  options: { concurrency: number; queueName?: string },
): Worker<TaskJob> {
  return new Worker<TaskJob>(
    options.queueName ?? taskQueueName,
    (job) => processTask(job.data.taskId, deps),
    { connection, concurrency: options.concurrency },
  );
}
