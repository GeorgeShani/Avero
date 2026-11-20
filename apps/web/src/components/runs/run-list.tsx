'use client';

import type { ReviewState, RunListItem } from '@avero/contracts';
import { Alert, Card, ItemList, TaskStatusBadge } from '@avero/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { badgeState, formatMoney } from './replay';
import './runs.css';
import './verdict.css';

function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return seconds < 60
    ? `${seconds.toFixed(1)} s`
    : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

/** UTC in a fixed format, not the viewer's locale, so the server and the browser print the same text. */
function startedAt(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

const decisionLabels = {
  approved: 'approved',
  'changes-requested': 'changes requested',
  rejected: 'rejected',
} as const;

/** The reviewer's risk and the person's decision, in words, so colour is never the only signal. */
function reviewLabel(review: ReviewState): string {
  const risk = review.risk ? `${review.risk} risk` : 'no review';
  return review.decision ? `${risk} · ${decisionLabels[review.decision]}` : `${risk} · open`;
}

export function RunList({
  runs,
  problems,
  dir,
}: {
  runs: RunListItem[];
  problems: { file: string; message: string }[];
  dir: string;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(runs[0]?.runId ?? '');

  return (
    <div data-stack>
      {problems.length > 0 && (
        <Alert tone="warning" title={`${problems.length} file(s) could not be read as runs`}>
          {problems.map((problem) => `${problem.file}: ${problem.message}`).join(' · ')}
        </Alert>
      )}
      {runs.length === 0 ? (
        <Card title="No runs yet">
          <div data-rp="empty">
            <p>
              Record one with a Cursor agent. It edits the folder you point it at and saves
              everything it did.
            </p>
            <pre data-rp="command">
              {'pnpm avero run "fix the flaky retry test" --cwd <your repository>'}
            </pre>
            <p data-rp="dim">Looking in {dir}</p>
          </div>
        </Card>
      ) : (
        <Card title="Recorded runs" description={`Read from ${dir}`}>
          <div data-rp="scroll">
            <ItemList
              label="Recorded runs"
              rows={runs}
              rowKey={(row) => row.runId}
              value={chosen}
              onValueChange={(id) => {
                setChosen(id);
                router.push(`/runs/${id}`);
              }}
              columns={[
                {
                  key: 'status',
                  label: 'Status',
                  width: '140px',
                  render: (row) => <TaskStatusBadge state={badgeState(row.status)} />,
                },
                {
                  key: 'task',
                  label: 'Task',
                  width: 'minmax(180px, 1fr)',
                  render: (row) => <span data-rp="cell-task">{row.task}</span>,
                },
                {
                  key: 'review',
                  label: 'Review',
                  width: '170px',
                  render: (row) => (
                    <span data-rp="cell-review" data-risk={row.review.risk}>
                      {reviewLabel(row.review)}
                    </span>
                  ),
                },
                {
                  key: 'time',
                  label: 'Time',
                  width: '72px',
                  align: 'end',
                  render: (row) => duration(row.durationMs),
                },
                {
                  key: 'cost',
                  label: 'Cost',
                  width: '100px',
                  align: 'end',
                  render: (row) => formatMoney(row.costCents ?? undefined),
                },
                {
                  key: 'changes',
                  label: 'Changes',
                  width: '104px',
                  align: 'end',
                  render: (row) => `${row.filesChanged} +${row.additions} −${row.deletions}`,
                },
                {
                  key: 'when',
                  label: 'Started',
                  width: '126px',
                  render: (row) => startedAt(row.startedAt),
                },
              ]}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
