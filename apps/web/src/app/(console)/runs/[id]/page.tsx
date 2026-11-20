import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RunReplay } from '../../../../components/runs/run-replay';
import { VerdictPanel } from '../../../../components/runs/verdict-panel';
import { loadRun, viewerReadOnly } from '../../../../server/runs';

export const metadata: Metadata = { title: 'Run' };
export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadRun(id);
  if (!loaded) notFound();
  const { record, verdict, decision } = loaded;
  return (
    <RunReplay
      record={record}
      review={
        <VerdictPanel
          runId={record.started.runId}
          verdict={verdict}
          decision={decision}
          readOnly={viewerReadOnly()}
        />
      }
    />
  );
}
