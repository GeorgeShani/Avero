import type { ReactNode } from 'react';
import { ClerkBoundary } from '../../components/clerk-boundary';
import { ConsoleShell } from '../../features/console-shell/shell';
import { awaitingDecision } from '../../features/review/queue';
import { loadSuites } from '../../server/bench';
import { loadHostedState } from '../../server/console-context';
import { loadRuns, viewerReadOnly } from '../../server/runs';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const [{ runs, dir }, { suites }, hosted] = await Promise.all([
    loadRuns(),
    loadSuites(),
    loadHostedState(),
  ]);
  const waiting = awaitingDecision(runs);
  return (
    <ClerkBoundary>
      <ConsoleShell
        data={{
          runs: runs.length,
          toDecide: waiting.length,
          risky: waiting.filter((run) => run.review.risk === 'medium' || run.review.risk === 'high')
            .length,
          suites: suites.length,
          dir,
          readOnly: viewerReadOnly(),
          recent: runs.slice(0, 12).map((run) => ({ id: run.runId, task: run.task })),
          suiteIds: suites.map((suite) => suite.id),
          hosted,
        }}
      >
        {children}
      </ConsoleShell>
    </ClerkBoundary>
  );
}
