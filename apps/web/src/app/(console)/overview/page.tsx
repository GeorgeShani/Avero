import type { Metadata } from 'next';
import { RunsOverview } from '../../../components/runs/runs-overview';
import { loadRuns } from '../../../server/runs';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const { runs, problems, dir } = await loadRuns();
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Overview</h1>
          <p>
            Totals across the agent runs recorded on this machine, and the latest few. Everything
            here is read from run records. Nothing is simulated.
          </p>
        </div>
      </div>
      <RunsOverview runs={runs} problems={problems} dir={dir} />
    </>
  );
}
