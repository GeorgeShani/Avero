import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Changes } from '../../../../features/runs/changes';
import { Note, PageHead, Panel, Stat, StatusTag } from '../../../../components/console/primitives';
import { Replay } from '../../../../features/runs/replay';
import { ReviewPanel } from '../../../../features/review/review-panel';
import { formatMoney, runLength, tokensAt } from '../../../../features/runs/replay-model';
import { loadRun, viewerReadOnly } from '../../../../server/runs';
import { compact, seconds, stamp } from '../../../../lib/format';

export const metadata: Metadata = { title: 'Run' };
export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadRun(id);
  if (!loaded) notFound();
  const { record, verdict, decision } = loaded;
  const { started, finished } = record;
  const length = runLength(record);
  const changes = finished?.changes;

  return (
    <>
      <PageHead title={started.task} actions={<StatusTag status={finished?.status ?? 'RUNNING'} />}>
        <span data-mono>{started.runId}</span> · {started.model} · recorded{' '}
        {stamp(started.startedAt)} UTC · folder “{started.workspace}”
      </PageHead>

      <dl data-stats aria-label="This run">
        <Stat label="Duration" value={seconds(finished?.durationMs ?? length)} />
        <Stat
          label="Tokens"
          value={compact(finished?.usage?.totalTokens ?? tokensAt(record, length))}
        />
        <Stat label="Billed cost" value={formatMoney(finished?.cost?.chargedCents)} />
        <Stat
          label="Changes"
          value={changes ? `${changes.files.length} files` : 'none'}
          note={
            changes ? (
              <>
                <span data-add>+{changes.additions}</span>{' '}
                <span data-del>−{changes.deletions}</span>
              </>
            ) : (
              'not a git repository'
            )
          }
        />
      </dl>

      <div data-grid="split">
        <div data-stack>
          <Replay record={record} />
          <Changes record={record} />
          <div data-grid="two">
            <Panel title="Task">
              <p data-prose>{started.task}</p>
            </Panel>
            <Panel title={finished ? 'Result' : 'Result (run did not finish)'}>
              {finished?.error && (
                <div style={{ marginBottom: 10 }}>
                  <Note tone="bad" title="The run ended with an error.">
                    {finished.error}
                  </Note>
                </div>
              )}
              <p data-prose>
                {finished?.result ?? (finished?.error ? '' : 'No final message was recorded.')}
              </p>
            </Panel>
          </div>
        </div>
        <ReviewPanel
          runId={started.runId}
          verdict={verdict}
          decision={decision}
          readOnly={viewerReadOnly()}
        />
      </div>
    </>
  );
}
