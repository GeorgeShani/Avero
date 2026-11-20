import { Card } from '@avero/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import '../../../components/bench/bench.css';
import { when } from '../../../components/bench/format';
import { loadSuites } from '../../../server/bench';

export const metadata: Metadata = { title: 'Bench' };
export const dynamic = 'force-dynamic';

export default async function BenchPage() {
  const { suites, dir } = await loadSuites();
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Bench</h1>
          <p>
            Tasks taken from your repository&apos;s own history, run under each setup you want to
            compare. Every attempt is a recorded run.
          </p>
        </div>
      </div>
      {suites.length === 0 ? (
        <Card title="No bench suites yet">
          <p>Build one from a repository&apos;s history, then run it:</p>
          <pre data-bn="rules">
            {
              'pnpm avero bench init --repo <your repository> --test "npm test"\npnpm avero bench run <suite> --repo <your repository> --model composer-2.5 --rules AGENTS.md'
            }
          </pre>
          <p data-bn="dim">Looking in {dir}</p>
        </Card>
      ) : (
        <Card title="Suites" description={`Read from ${dir}`}>
          <div data-bn="scroll">
            <table data-bn="table">
              <thead>
                <tr>
                  <th scope="col">Suite</th>
                  <th scope="col">Repository</th>
                  <th scope="col">Tasks</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {suites.map((suite) => (
                  <tr key={suite.id}>
                    <th scope="row">
                      <Link href={`/bench/${suite.id}`}>{suite.id}</Link>
                    </th>
                    <td>{suite.repo.name}</td>
                    <td>{suite.tasks.length}</td>
                    <td>{when(suite.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
