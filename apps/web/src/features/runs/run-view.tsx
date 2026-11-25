import type { LoadedRun } from '@avero/contracts';
import type { ReactNode } from 'react';
import { Note, PageHead, Panel, Stat, StatusTag } from '../../components/console/primitives';
import { compact, seconds, stamp } from '../../lib/format';
import { Changes } from './changes';
import { Replay } from './replay';
import { formatMoney, runLength, tokensAt } from './replay-model';

/**
 * One recorded run: the numbers, the replay, the diff, and a review panel the caller supplies. The
 * same view serves a run read from a folder on this machine and one stored in a workspace, so the
 * caller decides where decisions are saved. `head` is off where the page has its own title.
 */
export function RunView({
  loaded,
  review,
  head = true,
}: {
  loaded: LoadedRun;
  review: ReactNode;
  head?: boolean;
}) {
  const { record } = loaded;
  const { started, finished } = record;
  const length = runLength(record);
  const changes = finished?.changes;

  return (
    <>
      {head && (
        <PageHead
          title={started.task}
          actions={<StatusTag status={finished?.status ?? 'RUNNING'} />}
        >
          <span data-mono>{started.runId}</span> · {started.model} · recorded{' '}
          {stamp(started.startedAt)} UTC · folder “{started.workspace}”
        </PageHead>
      )}

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
            <Panel title={finished ? 'Result' : 'Result (the run did not finish)'}>
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
        {review}
      </div>
    </>
  );
}
