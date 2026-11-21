import { publishOutbox, recoverStaleTasks, type AveroDatabase } from '@avero/db';
import { recordOutboxPublished, recordRecovery, writeLog } from '@avero/observability';
import type { Queue } from 'bullmq';
import { lifecyclePolicy } from '../lifecycle/policy.ts';
import { enqueueTask, type TaskJob } from '../queues/index.ts';

/** Runs `step` now and then every `everyMs`, one at a time, until stopped. Errors are logged. */
function every(name: string, everyMs: number, step: () => Promise<void>): () => Promise<void> {
  let stopped = false;
  const run = async () => {
    try {
      await step();
    } catch {
      writeLog('error', `${name}.failed`);
    }
  };
  let current: Promise<void> = run();
  const timer = setInterval(() => {
    if (!stopped) current = current.then(run);
  }, everyMs);
  return async () => {
    stopped = true;
    clearInterval(timer);
    await current;
  };
}

/** Moves tasks saved in the database onto the queue. Returns a function that stops it. */
export function startOutboxRelay(
  db: AveroDatabase,
  queue: Queue<TaskJob>,
  everyMs: number = lifecyclePolicy.relayMs,
) {
  return every('outbox', everyMs, async () => {
    const published = await publishOutbox(db, (item) => enqueueTask(queue, item));
    recordOutboxPublished(published);
    if (published > 0) writeLog('info', 'outbox.published', { count: published });
  });
}

/** Settles tasks whose worker disappeared, now and on a timer. Returns a function that stops it. */
export function startRecovery(
  db: AveroDatabase,
  options: {
    everyMs?: number;
    staleAfterMs?: number;
    maxAttempts?: number;
    lostJobAfterMs?: number;
  } = {},
) {
  return every('recovery', options.everyMs ?? lifecyclePolicy.recoveryMs, async () => {
    const result = await recoverStaleTasks(db, {
      staleAfterMs: options.staleAfterMs ?? lifecyclePolicy.staleAfterMs,
      maxAttempts: options.maxAttempts ?? lifecyclePolicy.maxAttempts,
      lostJobAfterMs: options.lostJobAfterMs ?? lifecyclePolicy.lostJobAfterMs,
    });
    recordRecovery(result);
    if (result.requeued + result.failed + result.cancelled + result.republished > 0) {
      writeLog('info', 'recovery.settled', result);
    }
  });
}
