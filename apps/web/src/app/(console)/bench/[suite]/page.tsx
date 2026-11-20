import { Card } from '@avero/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../../../components/bench/bench.css';
import { when } from '../../../../components/bench/format';
import { loadSuite } from '../../../../server/bench';

export const metadata: Metadata = { title: 'Bench suite' };
export const dynamic = 'force-dynamic';

export default async function SuitePage({ params }: { params: Promise<{ suite: string }> }) {
  const { suite: suiteId } = await params;
  const loaded = await loadSuite(suiteId);
  if (!loaded) notFound();
  const { suite, results, hillclimbs } = loaded;
  return (
    <>
      <div data-page-head>
        <div>
          <h1>{suite.id}</h1>
          <p>
            {suite.tasks.length} task(s) from {suite.repo.name}. Tests run with{' '}
            <code>{suite.testCommand}</code>. The agent never sees the tests; they are put back
            afterwards and decide.
          </p>
        </div>
      </div>
      <div data-stack>
        <Card title="Results" description="Newest first. Open one for the full matrix.">
          {results.length === 0 ? (
            <p>
              No results yet. Run: pnpm avero bench run {suite.id} --repo &lt;your repository&gt;
            </p>
          ) : (
            <ul data-bn="steps">
              {[...results].reverse().map((result) => (
                <li key={result.id}>
                  <p data-bn="step-title">
                    <Link href={`/bench/${suite.id}/${result.id}`}>{when(result.startedAt)}</Link>
                  </p>
                  <p data-bn="dim">{result.configs.map((config) => config.label).join(' · ')}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {hillclimbs.length > 0 && (
          <Card title="Hillclimbs" description="Rules improved one measured change at a time.">
            <ul data-bn="steps">
              {[...hillclimbs].reverse().map((climb) => (
                <li key={climb.id}>
                  <p data-bn="step-title">
                    <Link href={`/bench/${suite.id}/${climb.id}`}>{when(climb.startedAt)}</Link>
                  </p>
                  <p data-bn="dim">
                    {climb.model} · best:{' '}
                    {climb.bestIteration === 0
                      ? 'the starting rules'
                      : `change ${climb.bestIteration}`}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Tasks">
          <ul data-bn="steps">
            {suite.tasks.map((task) => (
              <li key={task.id}>
                <p data-bn="step-title">{task.title}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
