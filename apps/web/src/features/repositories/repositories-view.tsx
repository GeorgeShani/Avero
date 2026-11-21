'use client';

import type { Repository } from '@avero/contracts';
import { useState } from 'react';
import { Note, Panel } from '../../components/console/primitives';
import { stamp } from '../../lib/format';
import { call } from '../api-call';

const kindWords: Record<Repository['kind'], string> = {
  local: 'Folder on the worker',
  github: 'GitHub',
};

/** The repositories tasks can run in, and how to add one. */
export function RepositoriesView({
  workspaceId,
  initial,
  canManage,
  canRegisterFolders,
  githubConnectUrl,
}: {
  workspaceId: string;
  initial: Repository[];
  canManage: boolean;
  /** False when the server has no folders set up for repositories. */
  canRegisterFolders: boolean;
  /** Where to start installing the GitHub App; undefined when GitHub is not set up here. */
  githubConnectUrl: string | undefined;
}) {
  const [repositories, setRepositories] = useState(initial);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState<string>();

  const register = async () => {
    setError(undefined);
    const result = await call<Repository>(`/api/v1/workspaces/${workspaceId}/repositories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, path }),
    });
    if (!result.ok) return setError(result.error);
    const added = result.data;
    setRepositories((list) => [...list, added].sort((a, b) => a.name.localeCompare(b.name)));
    setName('');
    setPath('');
  };

  return (
    <div data-stack>
      {error && (
        <Note tone="bad" title="That did not work.">
          {error}
        </Note>
      )}

      <Panel
        title="Repositories"
        hint="Tasks run on a copy of the repository; the repository itself is never touched"
        flush
      >
        {repositories.length === 0 ? (
          <p data-dim style={{ padding: 16 }}>
            No repository is connected to this workspace yet.
          </p>
        ) : (
          <ul data-items>
            {repositories.map((repository) => (
              <li key={repository.id} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <div data-item-main>
                  <span style={{ fontWeight: 500 }}>{repository.name}</span>
                  <span data-item-meta>
                    {kindWords[repository.kind]} · added {stamp(repository.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Connect GitHub"
        hint="Install the Avero GitHub App to review pull requests and run tasks on its repositories"
      >
        {githubConnectUrl ? (
          canManage ? (
            <a href={githubConnectUrl} data-btn data-primary>
              Connect GitHub
            </a>
          ) : (
            <p data-dim>Only owners and admins can connect GitHub.</p>
          )
        ) : (
          <p data-dim>
            GitHub is not set up on this server. It needs the GitHub App&apos;s credentials in the
            server&apos;s environment (see the development guide).
          </p>
        )}
      </Panel>

      <Panel
        title="Add a folder"
        hint="A repository on the machine the worker runs on, inside the folders the server allows"
      >
        {!canManage ? (
          <p data-dim>Only owners and admins can add repositories.</p>
        ) : !canRegisterFolders ? (
          <p data-dim>
            This server has no folders set up for repositories. Set{' '}
            <code>AVERO_REPOSITORY_ROOTS</code> to the folders the worker may use.
          </p>
        ) : (
          <div data-stack>
            <input
              data-field
              aria-label="Name"
              placeholder="Name, for example my-app"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              data-field
              aria-label="Folder"
              placeholder="Folder, for example /work/my-app"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            <div>
              <button
                type="button"
                data-btn
                data-primary
                disabled={name.trim() === '' || path.trim() === ''}
                onClick={() => void register()}
              >
                Add repository
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
