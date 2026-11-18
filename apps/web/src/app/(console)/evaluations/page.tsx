import type { Metadata } from 'next';
import { EvaluationsView } from '../../../components/simple-pages';

export const metadata: Metadata = { title: 'Evaluations' };

export default function Page() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Evaluations</h1>
          <p>Pass and fail results, scores and regressions for agent suites.</p>
        </div>
      </div>
      <EvaluationsView />
    </>
  );
}
