import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BenchResultView } from '../../../../../features/bench/bench-result';
import { HillclimbView } from '../../../../../features/bench/hillclimb-view';
import { PageHead } from '../../../../../components/console/primitives';
import { loadResult } from '../../../../../server/bench';
import { stamp } from '../../../../../lib/format';

export const metadata: Metadata = { title: 'Bench result' };
export const dynamic = 'force-dynamic';

export default async function ResultPage({
  params,
}: {
  params: Promise<{ suite: string; id: string }>;
}) {
  const { suite: suiteId, id } = await params;
  const loaded = await loadResult(suiteId, id);
  if (!loaded) notFound();
  const { suite, result, hillclimb } = loaded;
  return (
    <>
      <PageHead title={suite.id}>
        {result ? 'Result' : 'Hillclimb'} · {stamp((result ?? hillclimb)?.startedAt ?? '')} UTC
      </PageHead>
      {result ? <BenchResultView suite={suite} result={result} /> : null}
      {hillclimb ? <HillclimbView climb={hillclimb} /> : null}
    </>
  );
}
