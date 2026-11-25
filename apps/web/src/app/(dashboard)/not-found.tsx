import Link from 'next/link';
import { Empty, PageHead, Panel } from '../../components/console/primitives';

/** A run, task, suite or workspace that does not exist (or that you cannot see). */
export default function ConsoleNotFound() {
  return (
    <>
      <PageHead title="Not found">There is nothing at this address.</PageHead>
      <Panel title="It may have been removed, or the link may be wrong">
        <Empty title="Try one of these instead.">
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/overview" data-btn data-primary>
              Overview
            </Link>
            <Link href="/runs" data-btn>
              Runs
            </Link>
            <Link href="/tasks" data-btn>
              Tasks
            </Link>
          </span>
        </Empty>
      </Panel>
    </>
  );
}
