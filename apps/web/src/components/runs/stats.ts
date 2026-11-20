import type { RunSummary } from '@avero/contracts';

export type OverviewStats = {
  runs: number;
  running: number;
  finished: number;
  /** Ended in an error, were cancelled or expired. */
  failed: number;
  totalTokens: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  /** Average time of the finished runs, or null when none finished. */
  averageDurationMs: number | null;
  /** Sum of billed cost in cents, or null when no run reported any. */
  costCents: number | null;
};

export function overviewStats(runs: readonly RunSummary[]): OverviewStats {
  const finished = runs.filter((run) => run.status === 'FINISHED');
  const reported = runs.filter((run) => run.costCents !== null);
  return {
    runs: runs.length,
    running: runs.filter((run) => run.status === 'RUNNING').length,
    finished: finished.length,
    failed: runs.filter((run) => run.status !== 'FINISHED' && run.status !== 'RUNNING').length,
    totalTokens: runs.reduce((sum, run) => sum + run.totalTokens, 0),
    filesChanged: runs.reduce((sum, run) => sum + run.filesChanged, 0),
    additions: runs.reduce((sum, run) => sum + run.additions, 0),
    deletions: runs.reduce((sum, run) => sum + run.deletions, 0),
    averageDurationMs:
      finished.length === 0
        ? null
        : finished.reduce((sum, run) => sum + run.durationMs, 0) / finished.length,
    costCents:
      reported.length === 0 ? null : reported.reduce((sum, run) => sum + (run.costCents ?? 0), 0),
  };
}
