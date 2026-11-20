import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RunReplay } from '../../../../components/runs/run-replay';
import { loadRun } from '../../../../server/runs';

export const metadata: Metadata = { title: 'Run' };
export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await loadRun(id);
  if (!record) notFound();
  return <RunReplay record={record} />;
}
