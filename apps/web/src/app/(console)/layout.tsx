import type { ReactNode } from 'react';
import { ConsoleShell } from '../../components/console/shell';
import { awaitingDecision } from '../../components/console/queue';
import { loadSuites } from '../../server/bench';
import { loadRuns, viewerReadOnly } from '../../server/runs';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const [{ runs, dir }, { suites }] = await Promise.all([loadRuns(), loadSuites()]);
  const waiting = awaitingDecision(runs);
  return (
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
      }}
    >
      {children}
    </ConsoleShell>
  );
}
