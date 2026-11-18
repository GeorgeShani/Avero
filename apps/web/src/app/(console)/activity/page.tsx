import type { Metadata } from 'next';
import { ActivityView } from '../../../components/simple-pages';

export const metadata: Metadata = { title: 'Activity' };

export default function Page() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Activity</h1>
          <p>Execution history, webhook deliveries, audit records and errors.</p>
        </div>
      </div>
      <ActivityView />
    </>
  );
}
