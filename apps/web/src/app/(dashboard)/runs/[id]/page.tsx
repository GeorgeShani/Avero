import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumb } from '../../../../features/console-shell/crumb';
import { ReviewPanel } from '../../../../features/review/review-panel';
import { RunView } from '../../../../features/runs/run-view';
import { loadRun, viewerReadOnly } from '../../../../server/runs';
import { decideRun } from './actions';

export const metadata: Metadata = { title: 'Run' };
export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadRun(id);
  if (!loaded) notFound();
  const { record, verdict, decision } = loaded;

  return (
    <>
      <Crumb label={record.started.task} />
      <RunView
        loaded={loaded}
        review={
          <ReviewPanel
            runId={record.started.runId}
            verdict={verdict}
            decision={decision}
            readOnly={viewerReadOnly()}
            decide={decideRun}
          />
        }
      />
    </>
  );
}
