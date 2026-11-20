'use client';

import type { RunRecord } from '@avero/contracts';
import { Alert, Card, ItemList, TaskStatusBadge } from '@avero/ui';
import { useMemo, useState } from 'react';
import { badgeState, formatMoney, runLength, splitPatch, tokensAt } from './replay';
import { ReplayScope } from './replay-scope';
import './runs.css';

function seconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function RunReplay({ record }: { record: RunRecord }) {
  const length = useMemo(() => runLength(record), [record]);
  const patches = useMemo(() => splitPatch(record.finished?.changes?.patch), [record]);
  const [file, setFile] = useState(record.finished?.changes?.files[0]?.path ?? '');

  const { started, finished } = record;
  const status = finished?.status ?? 'RUNNING';
  const changes = finished?.changes;
  const selected = patches.find((patch) => patch.path === file);
  return (
    <div data-stack>
      <div data-page-head>
        <div>
          <h1 data-rp="title">{started.task}</h1>
          <p>
            {started.runId} · {started.model} · recorded{' '}
            {started.startedAt.slice(0, 16).replace('T', ' ')} UTC · folder “{started.workspace}”
          </p>
        </div>
        <TaskStatusBadge state={badgeState(status)} />
      </div>

      <dl data-rp="facts">
        <div>
          <dt>Duration</dt>
          <dd>{seconds(finished?.durationMs ?? length)}</dd>
        </div>
        <div>
          <dt>Tokens</dt>
          <dd>
            {(finished?.usage?.totalTokens ?? tokensAt(record, length)).toLocaleString('en-US')}
          </dd>
        </div>
        <div>
          <dt>Billed cost</dt>
          <dd>{formatMoney(finished?.cost?.chargedCents)}</dd>
        </div>
        <div>
          <dt>Changes</dt>
          <dd>
            {changes
              ? `${changes.files.length} files +${changes.additions} −${changes.deletions}`
              : 'none recorded'}
          </dd>
        </div>
      </dl>

      <ReplayScope record={record} />

      <div data-columns>
        <Card title="Task">
          <p data-rp="prose">{started.task}</p>
        </Card>
        <Card title={finished ? 'Result' : 'Result (run did not finish)'}>
          {finished?.error && (
            <Alert tone="danger" title="The run ended with an error">
              {finished.error}
            </Alert>
          )}
          <p data-rp="prose">
            {finished?.result ?? (finished?.error ? '' : 'No final message was recorded.')}
          </p>
        </Card>
      </div>

      <Card
        title="Changes"
        description={
          changes
            ? `${changes.files.length} files changed in “${started.workspace}”, counted from git when the run ended.`
            : 'This folder is not a git repository, so changes were not recorded.'
        }
      >
        {changes && changes.files.length === 0 && (
          <p data-rp="prose">The agent changed no files.</p>
        )}
        {changes && changes.files.length > 0 && (
          <div data-rp="changes">
            <ItemList
              label="Changed files"
              rows={changes.files}
              rowKey={(row) => row.path}
              value={file}
              onValueChange={setFile}
              columns={[
                { key: 'status', label: 'Change', width: '90px', render: (row) => row.status },
                { key: 'path', label: 'File', width: 'minmax(0, 1fr)', render: (row) => row.path },
                {
                  key: 'add',
                  label: '+',
                  width: '44px',
                  align: 'end',
                  render: (row) => row.additions ?? '–',
                },
                {
                  key: 'del',
                  label: '−',
                  width: '44px',
                  align: 'end',
                  render: (row) => row.deletions ?? '–',
                },
              ]}
            />
            {changes.patchTruncated && (
              <Alert tone="warning" title="The patch was cut at 200,000 characters">
                Later files may be missing below. The file list above is complete.
              </Alert>
            )}
            <div
              data-rp="patch"
              role="region"
              aria-label={selected ? `Changes to ${selected.path}` : 'Patch'}
            >
              {selected ? (
                selected.lines.map((line, index) => (
                  <div key={index} data-kind={line.kind}>
                    {line.text || ' '}
                  </div>
                ))
              ) : (
                <div data-kind="meta">
                  {changes.files.find((entry) => entry.path === file)?.status === 'untracked'
                    ? 'A new file git did not track yet, so it has no patch. It was counted by its lines.'
                    : 'No patch was recorded for this file.'}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
