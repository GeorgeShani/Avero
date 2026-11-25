import type { ReactNode } from 'react';
import { ClerkBoundary } from '../../components/clerk-boundary';
import { ConsoleShell } from '../../features/console-shell/shell';
import { awaitingDecision } from '../../features/review/queue';
import { loadHostedState, loadLocalData } from '../../server/console-context';
import { viewerReadOnly } from '../../server/runs';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const [{ runs, dir, suites, failed }, hosted] = await Promise.all([
    loadLocalData(),
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
          notice: failed
            ? 'Could not read the recordings folder, so the counts here may be missing.'
            : undefined,
        }}
      >
        {children}
      </ConsoleShell>
    </ClerkBoundary>
  );
}
