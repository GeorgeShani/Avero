import type { Metadata } from 'next';
import { Empty, Note, PageHead, Panel } from '../../../components/console/primitives';
import { RunsExplorer } from '../../../features/runs/runs-explorer';
import { loadRuns } from '../../../server/runs';

export const metadata: Metadata = { title: 'Runs' };
export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const { runs, problems, dir } = await loadRuns();
  return (
    <>
      <PageHead title="Runs">
        Recordings of real agent runs, read from files on this machine. Open one to replay it and
        review it.
      </PageHead>
      {problems.length > 0 && (
        <Note tone="warn" title={`${problems.length} file(s) could not be read as runs.`}>
          {problems.map((problem) => `${problem.file}: ${problem.message}`).join(' · ')}
        </Note>
      )}
      {runs.length === 0 ? (
        <Panel title="No runs yet" hint={`Looking in ${dir}`}>
          <Empty title="Record one with a Cursor agent.">
            <span>It edits the folder you point it at and saves everything it did.</span>
            <pre data-cmd>
              pnpm avero run &quot;fix the flaky retry test&quot; --cwd &lt;your repository&gt;
            </pre>
          </Empty>
        </Panel>
      ) : (
        <RunsExplorer runs={runs} />
      )}
    </>
  );
}
