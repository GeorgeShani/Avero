'use client';

import {
  isTerminal,
  type Agent,
  type Repository,
  type Task,
  type TaskEvent,
} from '@avero/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Note, Panel } from '../../components/console/primitives';
import { seconds, stamp } from '../../lib/format';
import { call } from '../api-call';

const statusWords: Record<Task['status'], { glyph: string; word: string; tone: string }> = {
  queued: { glyph: '○', word: 'Queued', tone: 'quiet' },
  running: { glyph: '◔', word: 'Running', tone: 'warn' },
  cancelling: { glyph: '■', word: 'Stopping', tone: 'warn' },
  finished: { glyph: '✓', word: 'Finished', tone: 'ok' },
  failed: { glyph: '✕', word: 'Failed', tone: 'bad' },
  cancelled: { glyph: '■', word: 'Cancelled', tone: 'quiet' },
};

function describeEvent(item: TaskEvent): string {
  const event = item.event;
  switch (event.type) {
    case 'run.started':
      return `Started ${event.model}`;
    case 'assistant':
      return event.text.replace(/\s+/g, ' ').slice(0, 160);
    case 'tool':
      return event.status === 'running'
        ? `Running ${event.name}…`
        : `${event.name} ${event.status}`;
    case 'run.finished':
      return `Ended: ${event.status.toLowerCase()}`;
    case 'note':
      return event.text;
    case 'gate':
      return `${event.kind} ${event.outcome}`;
    default:
      return '';
  }
}

/** Launch tasks, watch them run, and stop them. Talks to the workspace's task API. */
export function TasksView({
  workspaceId,
  repositories,
  agents,
  initialTasks,
  canLaunch,
}: {
  workspaceId: string;
  repositories: Repository[];
  agents: Agent[];
  initialTasks: Task[];
  canLaunch: boolean;
}) {
  const base = `/api/v1/workspaces/${workspaceId}`;
  const [tasks, setTasks] = useState(initialTasks);
  const [error, setError] = useState<string>();
  const [prompt, setPrompt] = useState('');
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '');
  const [agentId, setAgentId] = useState('');
  const [review, setReview] = useState(false);
  const [following, setFollowing] = useState<string>();
  const [feed, setFeed] = useState<string[]>([]);
  const source = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    const result = await call<Task[]>(`${base}/tasks`);
    if (result.ok) setTasks(result.data);
  }, [base]);

  // Keep the list current while anything is still going.
  useEffect(() => {
    if (!tasks.some((task) => !isTerminal(task.status))) return;
    const timer = setInterval(() => void refresh(), 2000);
    return () => clearInterval(timer);
  }, [tasks, refresh]);

  useEffect(() => () => source.current?.close(), []);

  const follow = (task: Task) => {
    source.current?.close();
    setFollowing(task.id);
    setFeed([]);
    const stream = new EventSource(`${base}/tasks/${task.id}/events`);
    source.current = stream;
    stream.addEventListener('run', (message) => {
      const item = JSON.parse((message as MessageEvent<string>).data) as TaskEvent;
      const line = describeEvent(item);
      if (line) setFeed((lines) => [...lines.slice(-199), line]);
    });
    stream.addEventListener('end', () => {
      stream.close();
      void refresh();
    });
    stream.onerror = () => stream.close();
  };

  const launch = async () => {
    setError(undefined);
    const result = await call<Task>(`${base}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repositoryId,
        prompt,
        ...(agentId ? { agentId } : {}),
        ...(review ? { review: true } : {}),
      }),
    });
    if (!result.ok) return setError(result.error);
    setPrompt('');
    await refresh();
    follow(result.data);
  };

  const cancel = async (task: Task) => {
    const result = await call<Task>(`${base}/tasks/${task.id}/cancel`, { method: 'POST' });
    if (!result.ok) setError(result.error);
    await refresh();
  };

  return (
    <div data-stack>
      {error && (
        <Note tone="bad" title="That did not work.">
          {error}
        </Note>
      )}

      <Panel
        title="Launch a task"
        hint="An agent works on a copy of the repository; the repository itself is never touched"
      >
        {repositories.length === 0 ? (
          <p data-dim>
            No repository is registered for this workspace yet. An owner or admin can add one on the{' '}
            <Link href={`/repositories?workspace=${workspaceId}`}>Repositories</Link> page.
          </p>
        ) : (
          <div data-stack>
            <select
              data-field
              aria-label="Repository"
              value={repositoryId}
              onChange={(event) => setRepositoryId(event.target.value)}
            >
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {repository.name}
                </option>
              ))}
            </select>
            {agents.length > 0 && (
              <select
                data-field
                aria-label="Agent"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
              >
                <option value="">Default agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.model})
                  </option>
                ))}
              </select>
            )}
            <textarea
              data-field
              aria-label="What should the agent do?"
              placeholder="What should the agent do?"
              rows={3}
              maxLength={8000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={review}
                onChange={(event) => setReview(event.target.checked)}
              />
              Have an independent reviewer check the result
            </label>
            <div>
              <button
                type="button"
                data-btn
                data-primary
                disabled={!canLaunch || prompt.trim() === ''}
                onClick={() => void launch()}
              >
                Launch
              </button>
              {!canLaunch && (
                <span data-dim style={{ marginLeft: 12 }}>
                  Your role in this workspace cannot launch tasks.
                </span>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Tasks" hint="Newest first" flush>
        {tasks.length === 0 ? (
          <p data-dim style={{ padding: 16 }}>
            Nothing has been launched yet.
          </p>
        ) : (
          <ul data-items>
            {tasks.map((task) => {
              const view = statusWords[task.status];
              return (
                <li key={task.id} style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}>
                  <span data-tag data-tone={view.tone}>
                    <i aria-hidden="true">{view.glyph}</i>
                    {view.word}
                  </span>
                  <div data-item-main>
                    <span style={{ fontWeight: 500 }}>{task.prompt}</span>
                    <span data-item-meta>
                      {task.model} · {stamp(task.createdAt)}
                      {task.attempt > 1 ? ` · attempt ${task.attempt}` : ''}
                      {task.error ? ` · ${task.error}` : ''}
                      {task.startedAt && task.finishedAt
                        ? ` · ${seconds(new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime())}`
                        : ''}
                    </span>
                  </div>
                  <span style={{ display: 'flex', gap: 8, position: 'relative' }}>
                    <button type="button" data-btn onClick={() => follow(task)}>
                      Follow
                    </button>
                    {task.runId && (
                      <Link href={`/runs/${task.runId}`} data-btn>
                        Open run
                      </Link>
                    )}
                    {!isTerminal(task.status) && task.status !== 'cancelling' && canLaunch && (
                      <button type="button" data-btn data-danger onClick={() => void cancel(task)}>
                        Cancel
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {following && (
        <Panel title="Live" hint="What the agent is doing, as it happens">
          <pre data-cmd aria-live="polite" style={{ maxHeight: 320, overflow: 'auto' }}>
            {feed.length === 0 ? 'Waiting for events…' : feed.join('\n')}
          </pre>
        </Panel>
      )}
    </div>
  );
}
