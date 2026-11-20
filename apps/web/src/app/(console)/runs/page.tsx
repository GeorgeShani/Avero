import type { Metadata } from 'next';
import { RunList } from '../../../components/runs/run-list';
import { loadRuns } from '../../../server/runs';

export const metadata: Metadata = { title: 'Runs' };
export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const { runs, problems, dir } = await loadRuns();
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Runs</h1>
          <p>
            Recordings of real agent runs, read from files on this machine. Nothing on this page is
            simulated.
          </p>
        </div>
      </div>
      <RunList runs={runs} problems={problems} dir={dir} />
    </>
  );
}
