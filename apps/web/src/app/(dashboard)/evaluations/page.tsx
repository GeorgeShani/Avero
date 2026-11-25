import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCommand } from '../../../components/console/copy-command';
import { Empty, PageHead, Panel, Term } from '../../../components/console/primitives';
import { loadSuites } from '../../../server/bench';
import { stamp } from '../../../lib/format';

export const metadata: Metadata = { title: 'Evaluations' };
export const dynamic = 'force-dynamic';

export default async function BenchPage() {
  const { suites, dir } = await loadSuites();
  return (
    <>
      <PageHead title="Evaluations">
        An <Term k="evaluation">evaluation</Term> answers which model and rules work best on your
        code. It takes a <Term k="suite">suite</Term> of tasks from your repository&apos;s own
        history and runs each under every <Term k="setup">setup</Term> you want to compare. Every
        attempt is a recorded run.
      </PageHead>
      {suites.length === 0 ? (
        <Panel title="No evaluation suites yet" hint={`Looking in ${dir}`}>
          <Empty title="Build a suite from a repository's history, then run it.">
            <span>First, build the suite:</span>
            <CopyCommand
              command={'pnpm avero bench init --repo <your repository> --test "npm test"'}
            />
            <span>Then run it under a setup:</span>
            <CopyCommand
              command={
                'pnpm avero bench run <suite> --repo <your repository> --model composer-2.5 --rules AGENTS.md'
              }
            />
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
