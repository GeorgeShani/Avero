import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BenchResultView } from '../../../../../components/bench/bench-result';
import { when } from '../../../../../components/bench/format';
import { HillclimbView } from '../../../../../components/bench/hillclimb-view';
import { PageHead } from '../../../../../components/console/primitives';
import { loadResult } from '../../../../../server/bench';

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
        {result ? 'Result' : 'Hillclimb'} · {when((result ?? hillclimb)?.startedAt ?? '')} UTC
      </PageHead>
      {result ? <BenchResultView suite={suite} result={result} /> : null}
      {hillclimb ? <HillclimbView climb={hillclimb} /> : null}
    </>
  );
}
