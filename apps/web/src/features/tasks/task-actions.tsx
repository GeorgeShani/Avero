'use client';

import { isTerminal, type Task } from '@avero/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Note } from '../../components/console/primitives';
import { call } from '../api-call';

/** Stop a task that is still going, or run a finished one again with the same settings. */
export function TaskActions({
  workspaceId,
  task,
  canLaunch,
}: {
  workspaceId: string;
  task: Task;
  canLaunch: boolean;
}) {
  const router = useRouter();
  const base = `/api/v1/workspaces/${workspaceId}/tasks`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!canLaunch) return null;

  const cancel = async () => {
    setBusy(true);
    setError(undefined);
    const result = await call<Task>(`${base}/${task.id}/cancel`, { method: 'POST' });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  };

  const retry = async () => {
    setBusy(true);
    setError(undefined);
    const result = await call<Task>(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repositoryId: task.repositoryId,
        prompt: task.prompt,
        ...(task.agentId ? { agentId: task.agentId } : {}),
        ...(task.review ? { review: true } : {}),
      }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.push(`/tasks/${result.data.id}`);
  };

  return (
    <div data-stack>
      <span style={{ display: 'flex', gap: 8 }}>
        {!isTerminal(task.status) && task.status !== 'cancelling' && (
          <button type="button" data-btn data-danger disabled={busy} onClick={() => void cancel()}>
            Cancel task
          </button>
        )}
        {isTerminal(task.status) && (
          <button type="button" data-btn disabled={busy} onClick={() => void retry()}>
            Run again
          </button>
        )}
      </span>
      {error && (
        <Note tone="bad" title="That did not work.">
          {error}
        </Note>
      )}
    </div>
  );
}
