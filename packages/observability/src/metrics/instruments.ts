import { metrics } from '@opentelemetry/api';

const meterName = 'avero';

/**
 * What Avero counts. Instruments come from the global meter at the moment of use, so they work
 * whether or not telemetry was started before the first call (without an SDK they do nothing).
 * Attributes are bounded sets of words, never ids: a metric with an id per series grows forever.
 */
function meter() {
  return metrics.getMeter(meterName);
}

/** A task ended. `status` is one of finished, failed or cancelled. */
export function recordTaskSettled(status: string, durationMs?: number): void {
  meter()
    .createCounter('avero.tasks.settled', { description: 'Tasks that reached an end state' })
    .add(1, { status });
  if (durationMs !== undefined) {
    meter()
      .createHistogram('avero.task.duration', {
        description: 'Time from start to end of a task',
        unit: 'ms',
      })
      .record(durationMs, { status });
  }
}

/** Outbox rows handed to the queue in one pass. */
export function recordOutboxPublished(count: number): void {
  if (count <= 0) return;
  meter()
    .createCounter('avero.outbox.published', { description: 'Outbox rows put on the queue' })
    .add(count);
}

/** What one recovery pass did with tasks whose worker had stopped. */
export function recordRecovery(result: {
  requeued: number;
  failed: number;
  cancelled: number;
  republished?: number;
}): void {
  const counter = meter().createCounter('avero.tasks.recovered', {
    description: 'Tasks found stuck and dealt with',
  });
  for (const [outcome, count] of Object.entries(result)) {
    if (count > 0) counter.add(count, { outcome });
  }
}

/** Shell commands the command guard refused, in a finished task. */
export function recordGuardDenied(count: number): void {
  if (count <= 0) return;
  meter()
    .createCounter('avero.guard.denied', { description: 'Commands the guard refused' })
    .add(count);
}
