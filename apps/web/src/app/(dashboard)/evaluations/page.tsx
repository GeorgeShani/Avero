import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHead, Panel } from '../../../components/console/primitives';
import { loadSuites } from '../../../server/bench';
import { stamp } from '../../../lib/format';

export const metadata: Metadata = { title: 'Evaluations' };
export const dynamic = 'force-dynamic';

export default async function BenchPage() {
  const { suites, dir } = await loadSuites();
  return (
    <>
      <PageHead title="Evaluations">
        Tasks taken from your repository&apos;s own history, run under each setup you want to
        compare. Every attempt is a recorded run.
      </PageHead>
      {suites.length === 0 ? (
        <Panel title="No evaluation suites yet" hint={`Looking in ${dir}`}>
          <Empty title="Build one from a repository's history, then run it.">
            <pre data-cmd>
              {`pnpm avero bench init --repo <your repository> --test "npm test"
pnpm avero bench run <suite> --repo <your repository> --model composer-2.5 --rules AGENTS.md`}
            </pre>
          </Empty>
        </Panel>
      ) : (
        <Panel title="Suites" hint={`Read from ${dir}`} flush>
          <div data-scroll>
            <table data-table>
              <thead>
                <tr>
                  <th scope="col">Suite</th>
                  <th scope="col">Repository</th>
                  <th scope="col" data-num>
                    Tasks
                  </th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {suites.map((suite) => (
                  <tr key={suite.id} data-trow>
                    <th scope="row">
                      <Link href={`/evaluations/${suite.id}`} data-trow-link>
                        {suite.id}
                      </Link>
                    </th>
                    <td data-dim>{suite.repo.name}</td>
                    <td data-num>{suite.tasks.length}</td>
                    <td data-dim>{stamp(suite.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
