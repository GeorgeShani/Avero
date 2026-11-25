'use client';

import type { TaskEvent } from '@avero/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { describeEvent } from './task-status';

/**
 * What a task did, one line per event. While the task is still going it follows the worker's
 * stream and, when the task ends, reloads the page so the recorded run appears under it.
 */
export function TaskLive({
  workspaceId,
  taskId,
  initial,
  lastSeq,
  active,
}: {
  workspaceId: string;
  taskId: string;
  /** The lines already stored when the page was drawn. */
  initial: string[];
  /** The last stored event, so the stream continues from there instead of repeating. */
  lastSeq: number;
  active: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState(initial);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    if (!active) return;
    const stream = new EventSource(
      `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/events?after=${lastSeq}`,
    );
    stream.addEventListener('run', (message) => {
      const item = JSON.parse((message as MessageEvent<string>).data) as TaskEvent;
      const line = describeEvent(item);
      if (line) setLines((all) => [...all.slice(-199), line]);
    });
    stream.addEventListener('end', () => {
      stream.close();
      router.refresh();
    });
    stream.onerror = () => {
      stream.close();
      setLost(true);
    };
    return () => stream.close();
  }, [active, workspaceId, taskId, lastSeq, router]);

  return (
    <>
      <pre data-cmd aria-live="polite" style={{ maxHeight: 320, overflow: 'auto' }}>
        {lines.length === 0
          ? active
            ? 'Waiting for the worker to pick this task up…'
            : 'No events were recorded.'
          : lines.join('\n')}
      </pre>
      {lost && (
        <p data-dim style={{ marginTop: 8 }}>
          The live connection dropped. Reload the page to see where the task is now.
        </p>
      )}
    </>
  );
}
