import type { RunListItem } from '@avero/contracts';
import Link from 'next/link';
import { compact, ReviewTags, seconds, stamp, StatusTag } from './primitives';

/** Recorded runs as a table. Each row opens the run; the whole row is the link target. */
export function RunsTable({ runs }: { runs: readonly RunListItem[] }) {
  return (
    <div data-scroll>
      <table data-table>
        <caption data-sr>Recorded runs</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Task</th>
            <th scope="col">Review</th>
            <th scope="col" data-num>
              Time
            </th>
            <th scope="col" data-num>
              Tokens
            </th>
            <th scope="col" data-num>
              Changes
            </th>
            <th scope="col">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.runId} data-trow>
              <td>
                <StatusTag status={run.status} />
              </td>
              <td data-wrap>
                <Link href={`/runs/${run.runId}`} data-trow-link>
                  {run.task}
                </Link>
                <span data-faint style={{ fontSize: 12 }}>
                  {run.model}
                </span>
              </td>
              <td>
                <ReviewTags review={run.review} />
              </td>
              <td data-num>{seconds(run.durationMs)}</td>
              <td data-num>{compact(run.totalTokens)}</td>
              <td data-num>
                {run.filesChanged} <span data-add>+{run.additions}</span>{' '}
                <span data-del>−{run.deletions}</span>
              </td>
              <td data-dim>{stamp(run.startedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
