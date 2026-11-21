import type { Metadata } from 'next';
import Link from 'next/link';
import { decidedRuns, awaitingDecision } from '../../../features/review/queue';
import {
  Empty,
  PageHead,
  Panel,
  ReviewTags,
  RiskTag,
  StatusTag,
} from '../../../components/console/primitives';
import { loadRuns } from '../../../server/runs';
import { seconds, stamp } from '../../../lib/format';

export const metadata: Metadata = { title: 'Review' };
export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const { runs } = await loadRuns();
  const waiting = awaitingDecision(runs);
  const decided = decidedRuns(runs);
  const unreviewed = waiting.filter((run) => !run.review.risk).length;

  return (
    <>
      <PageHead title="Review">
        Finished runs wait here until you decide. An independent reviewer agent reads the task and
        the diff and rates the risk; Avero checks its claims against the record; you approve,
        request changes or reject.
      </PageHead>

      <Panel
        title="Needs your decision"
        hint={
          waiting.length === 0
            ? undefined
            : `${waiting.length} waiting, riskiest first${unreviewed > 0 ? ` · ${unreviewed} not reviewed yet` : ''}`
        }
        flush
      >
        {waiting.length === 0 ? (
          <Empty title="Nothing is waiting.">
            <span>
              Record a run, then run <code>pnpm avero verdict &lt;run-id&gt;</code> to get a review.
            </span>
          </Empty>
        ) : (
          <ul data-items>
            {waiting.map((run) => (
              <li key={run.runId}>
                {run.review.risk ? (
                  <RiskTag tier={run.review.risk} />
                ) : (
                  <span data-tag data-tone="quiet">
                    not reviewed
                  </span>
                )}
                <div data-item-main>
                  <Link href={`/runs/${run.runId}`} data-item-title>
                    {run.task}
                  </Link>
                  <span data-item-meta>
                    {run.model} · {stamp(run.startedAt)} · {run.filesChanged} files +{run.additions}{' '}
                    −{run.deletions}
                    {run.review.failedChecks ? ` · ${run.review.failedChecks} failed check(s)` : ''}
                  </span>
                </div>
                <span data-dim data-mono>
                  {seconds(run.durationMs)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Decided" hint="Newest first" flush>
        {decided.length === 0 ? (
          <Empty title="No decisions yet." />
        ) : (
          <ul data-items>
            {decided.map((run) => (
              <li key={run.runId}>
                <StatusTag status={run.status} />
                <div data-item-main>
                  <Link href={`/runs/${run.runId}`} data-item-title>
                    {run.task}
                  </Link>
                  <span data-item-meta>
                    {run.model} · {stamp(run.startedAt)}
                  </span>
                </div>
                <ReviewTags review={run.review} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
