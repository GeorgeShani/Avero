import type { RunFinished } from '@avero/contracts';

/** How the worker treats time and retries. One place, so the tests and the code agree. */
export const lifecyclePolicy = {
  /** How often a running task is touched, which also is how often a stop request is noticed. */
  heartbeatMs: 2_000,
  /** A running task not touched for this long belongs to a worker that is gone. */
  staleAfterMs: 30_000,
  /** How many times a task is started before a lost worker makes it fail for good. */
  maxAttempts: 3,
  /** How often the outbox is moved to the queue, and stale tasks are looked for. */
  relayMs: 1_000,
  recoveryMs: 10_000,
} as const;

export type TaskOutcome = {
  status: 'finished' | 'failed' | 'cancelled';
  error?: string;
};

/**
 * What a task becomes when its run ended. The run's own status says how it ended; whether anyone
 * asked it to stop says why. A run that was cut off by a limit nobody asked for did not do its job,
 * so it fails, with the reason.
 */
export function outcomeFor(
  run: { status: RunFinished['status']; error?: string },
  stopRequested: boolean,
): TaskOutcome {
  if (stopRequested && run.status !== 'FINISHED') return { status: 'cancelled' };
  switch (run.status) {
    case 'FINISHED':
      return { status: 'finished' };
    case 'CANCELLED':
      return {
        status: 'failed',
        error: run.error ?? 'The run was stopped by a limit before it finished.',
      };
    case 'EXPIRED':
      return { status: 'failed', error: run.error ?? 'The agent session expired.' };
    case 'ERROR':
      return { status: 'failed', error: run.error ?? 'The agent ended with an error.' };
  }
}
