import type { RunListItem } from '@avero/contracts';

/** A run nobody reviewed ranks above one the reviewer rated low: nothing says it is safe. */
const rank = { high: 4, medium: 3, none: 2, low: 1 } as const;

/**
 * Finished runs nobody has decided on, the riskiest first and the newest first within a tier.
 */
export function awaitingDecision(runs: readonly RunListItem[]): RunListItem[] {
  return runs
    .filter((run) => run.status === 'FINISHED' && !run.review.decision)
    .sort((a, b) => {
      const byRisk = rank[b.review.risk ?? 'none'] - rank[a.review.risk ?? 'none'];
      return byRisk !== 0 ? byRisk : b.startedAt.localeCompare(a.startedAt);
    });
}

export function decidedRuns(runs: readonly RunListItem[]): RunListItem[] {
  return runs
    .filter((run) => run.review.decision)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
