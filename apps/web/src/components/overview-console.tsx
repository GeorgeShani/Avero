'use client';

import {
  BarGraph,
  Button,
  Device,
  Display,
  DPad,
  Icon,
  ItemList,
  notify,
  SlideSwitch,
  TaskStatusBadge,
  type TaskStatus,
} from '@avero/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSim } from '../lib/sim/provider';
import { activeStates, elapsed, eventTime, type SimTask } from '../lib/sim/store';

const pages = ['Overview', 'Task', 'Log'] as const;
const modes = ['All', 'Cloud', 'Local'] as const;
type Mode = (typeof modes)[number];

const primaryAction: Partial<Record<TaskStatus, { label: string; verb: string }>> = {
  'awaiting-approval': { label: 'Approve', verb: 'approve' },
  failed: { label: 'Retry', verb: 'retry' },
  cancelled: { label: 'Retry', verb: 'retry' },
  running: { label: 'Cancel', verb: 'cancel' },
  queued: { label: 'Cancel', verb: 'cancel' },
  preparing: { label: 'Cancel', verb: 'cancel' },
};

/** The overview as a handheld: the D-pad moves between pages and tasks, A acts, B opens. */
export function OverviewConsole() {
  const router = useRouter();
  const sim = useSim();
  const { tasks, tick, activity } = sim.state;
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<Mode>('All');
  const [chosenId, setChosenId] = useState(tasks[0]?.id ?? '');

  const visible = tasks.filter((task) => mode === 'All' || task.mode === mode);
  const task: SimTask | undefined =
    visible.find((candidate) => candidate.id === chosenId) ?? visible[0];
  const at = task ? visible.indexOf(task) : 0;

  const count = (...states: TaskStatus[]) =>
    visible.filter((item) => states.includes(item.status)).length;
  const action = task ? primaryAction[task.status] : undefined;

  const pad = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (dir === 'left') setPage((value) => (value + pages.length - 1) % pages.length);
    if (dir === 'right') setPage((value) => (value + 1) % pages.length);
    if (visible.length === 0) return;
    if (dir === 'up') setChosenId(visible[(at + visible.length - 1) % visible.length]!.id);
    if (dir === 'down') setChosenId(visible[(at + 1) % visible.length]!.id);
  };

  const act = () => {
    if (!task || !action) return;
    sim[action.verb as 'approve' | 'retry' | 'cancel'](task.id);
    notify(`${action.label}: ${task.title}`, { description: 'Simulated run', duration: 2000 });
  };

  return (
    <Device model="AV-1" name="Dashboard" on>
      <div data-dash>
        <div data-dash-pad>
          <DPad
            label="Navigate"
            onUp={() => pad('up')}
            onDown={() => pad('down')}
            onLeft={() => pad('left')}
            onRight={() => pad('right')}
          />
          <small aria-hidden>Nav</small>
        </div>

        <div data-dash-screen>
          <Display aspect="16 / 10">
            <div data-dash-view>
              <nav data-dash-pages aria-label="Console pages">
                {pages.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    aria-current={index === page || undefined}
                    onClick={() => setPage(index)}
                  >
                    {name}
                  </button>
                ))}
                <span>{mode}</span>
              </nav>
              {page === 0 && (
                <div data-dash-overview>
                  <dl>
                    <div>
                      <dt>Active</dt>
                      <dd>{count('queued', 'preparing', 'running')}</dd>
                    </div>
                    <div>
                      <dt>Approve</dt>
                      <dd>{count('awaiting-approval')}</dd>
                    </div>
                    <div>
                      <dt>Failed</dt>
                      <dd>{count('failed')}</dd>
                    </div>
                  </dl>
                  <BarGraph
                    label="Run events per tick, last 12 ticks"
                    values={activity.map((value) => Math.min(1, value / 5))}
                  />
                </div>
              )}
              {page === 1 && task && (
                <div data-dash-detail>
                  <span data-status={task.status}>{task.status.replace('-', ' ')}</span>
                  <strong>{task.title}</strong>
                  <dl>
                    <div>
                      <dt>Repo</dt>
                      <dd>{task.repo}</dd>
                    </div>
                    <div>
                      <dt>Agent</dt>
                      <dd>{task.agent}</dd>
                    </div>
                    <div>
                      <dt>Time</dt>
                      <dd>{elapsed(task, tick)}</dd>
                    </div>
                  </dl>
                </div>
              )}
              {page === 2 && task && (
                <ol data-dash-log>
                  {task.events.slice(-6).map((event) => (
                    <li key={event.id} data-error={event.kind === 'error' || undefined}>
                      <span>{eventTime(event)}</span>
                      {event.text}
                    </li>
                  ))}
                  {task.events.length === 0 && <li>Waiting to start…</li>}
                </ol>
              )}
              {!task && <p>No tasks match this filter.</p>}
            </div>
          </Display>
        </div>

        <div data-dash-right>
          <SlideSwitch
            label="Mode"
            orientation="vertical"
            options={[...modes]}
            value={mode}
            onValueChange={(value) => setMode(value as Mode)}
          />
          <div data-dash-ab>
            <div>
              <Button
                round
                aria-label="Open task workspace"
                disabled={!task}
                onClick={() => task && router.push(`/tasks/${task.id}`)}
              >
                <Icon name="check" />
              </Button>
              <small aria-hidden>Open</small>
            </div>
            <div>
              <Button
                round
                tone="primary"
                aria-label={action ? `${action.label} ${task?.title}` : 'No action'}
                disabled={!action}
                onClick={act}
              >
                <Icon name="rocket" />
              </Button>
              <small aria-hidden>{action?.label ?? '—'}</small>
            </div>
          </div>
        </div>
      </div>

      <ItemList
        label="Tasks"
        rows={visible}
        rowKey={(row) => row.id}
        value={task?.id ?? ''}
        onValueChange={setChosenId}
        columns={[
          { key: 'title', label: 'Task', width: 'minmax(0, 1.6fr)', render: (row) => row.title },
          { key: 'repo', label: 'Repo', width: 'minmax(0, 1fr)', render: (row) => row.repo },
          {
            key: 'status',
            label: 'Status',
            width: '150px',
            render: (row) => <TaskStatusBadge state={row.status} />,
          },
          {
            key: 'time',
            label: 'Time',
            width: '44px',
            align: 'end',
            render: (row) => elapsed(row, tick),
          },
        ]}
      />
      <small data-note>
        {tasks.filter((item) => activeStates.includes(item.status)).length} of {tasks.length} tasks
        active. Simulated runs: nothing here is executing.
      </small>
    </Device>
  );
}
