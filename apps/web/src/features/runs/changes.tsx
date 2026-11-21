'use client';

import type { RunRecord } from '@avero/contracts';
import { useMemo, useState } from 'react';
import { splitPatch } from './replay-model';
import { Empty, Note } from '../../components/console/primitives';

/** The files a run changed, and the diff of the one you pick. */
export function Changes({ record }: { record: RunRecord }) {
  const changes = record.finished?.changes;
  const patches = useMemo(() => splitPatch(changes?.patch), [changes]);
  const [file, setFile] = useState(changes?.files[0]?.path ?? '');
  const selected = patches.find((patch) => patch.path === file);
  const workspace = record.started.workspace;

  return (
    <section data-panel>
      <div data-panel-head>
        <div>
          <h2>Changes</h2>
          <p>
            {changes
              ? `${changes.files.length} files in “${workspace}”, counted from git when the run ended`
              : 'This folder is not a git repository, so changes were not recorded'}
          </p>
        </div>
        {changes ? (
          <span data-mono>
            <span data-add>+{changes.additions}</span> <span data-del>−{changes.deletions}</span>
          </span>
        ) : null}
      </div>
      {!changes ? null : changes.files.length === 0 ? (
        <Empty title="The agent changed no files." />
      ) : (
        <>
          {changes.patchTruncated && (
            <div style={{ padding: '12px 16px 0' }}>
              <Note tone="warn" title="The patch was cut at 200,000 characters.">
                Later files may be missing below. The file list is complete.
              </Note>
            </div>
          )}
          <div data-files>
            <ul data-file-list aria-label="Changed files">
              {changes.files.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    aria-pressed={entry.path === file}
                    onClick={() => setFile(entry.path)}
                    title={entry.path}
                  >
                    <span>{entry.path}</span>
                    <span data-dim>
                      {entry.status === 'added' || entry.status === 'untracked'
                        ? 'new'
                        : entry.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div
              data-patch
              role="region"
              tabIndex={0}
              aria-label={selected ? `Changes to ${selected.path}` : 'Patch'}
            >
              {selected ? (
                selected.lines.map((line, index) => (
                  <div key={index} data-kind={line.kind}>
                    {line.text || ' '}
                  </div>
                ))
              ) : (
                <div data-kind="meta" style={{ padding: 16 }}>
                  {changes.files.find((entry) => entry.path === file)?.status === 'untracked'
                    ? 'A new file git did not track yet, so it has no patch. It was counted by its lines.'
                    : 'No patch was recorded for this file.'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
