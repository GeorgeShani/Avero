import { ApprovalsCard } from '../../../components/approvals-card';
import { OverviewConsole } from '../../../components/overview-console';

export default function OverviewPage() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Overview</h1>
          <p>
            What is running, what needs a decision, and where to inspect the evidence. Drive it with
            the D-pad, or with the keyboard.
          </p>
        </div>
      </div>
      <div data-overview>
        <OverviewConsole />
        <ApprovalsCard />
      </div>
    </>
  );
}
