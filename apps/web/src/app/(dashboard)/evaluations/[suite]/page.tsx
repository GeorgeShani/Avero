import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Empty, PageHead, Panel } from '../../../../components/console/primitives';
import { loadSuite } from '../../../../server/bench';
import { stamp } from '../../../../lib/format';

export const metadata: Metadata = { title: 'Evaluation suite' };
export const dynamic = 'force-dynamic';

export default async function SuitePage({ params }: { params: Promise<{ suite: string }> }) {
  const { suite: suiteId } = await params;
  const loaded = await loadSuite(suiteId);
  if (!loaded) notFound();
  const { suite, results, hillclimbs } = loaded;
  return (
    <>
      <PageHead title={suite.id}>
        {suite.tasks.length} task(s) from {suite.repo.name}. Tests run with{' '}
        <code>{suite.testCommand}</code>. The agent never sees the tests; they are put back
        afterwards and decide.
      </PageHead>
      <div data-grid="two">
        <Panel title="Results" hint="Newest first. Open one for the full matrix." flush>
          {results.length === 0 ? (
            <Empty title="No results yet.">
              <pre data-cmd>{`pnpm avero bench run ${suite.id} --repo <your repository>`}</pre>
            </Empty>
          ) : (
            <ul data-items>
              {results.map((result) => (
                <li key={result.id} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <div data-item-main>
                    <Link href={`/evaluations/${suite.id}/${result.id}`} data-item-title>
                      {stamp(result.startedAt)}
                    </Link>
                    <span data-item-meta>
                      {result.configs.map((config) => config.label).join(' · ')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Hillclimbs" hint="Rules improved one measured change at a time" flush>
          {hillclimbs.length === 0 ? (
            <Empty title="None yet.">
              <pre
                data-cmd
              >{`pnpm avero bench hillclimb ${suite.id} --repo <your repository> --holdout 1`}</pre>
            </Empty>
          ) : (
            <ul data-items>
              {hillclimbs.map((climb) => (
                <li key={climb.id} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <div data-item-main>
                    <Link href={`/evaluations/${suite.id}/${climb.id}`} data-item-title>
                      {stamp(climb.startedAt)}
                    </Link>
                    <span data-item-meta>
                      {climb.model} · best:{' '}
                      {climb.bestIteration === 0
                        ? 'the starting rules'
                        : `change ${climb.bestIteration}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Tasks" hint="Mined from the repository's history" flush>
        <ul data-items>
          {suite.tasks.map((task) => (
            <li key={task.id} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <div data-item-main>
                <span data-item-title style={{ whiteSpace: 'normal' }}>
                  {task.title}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
