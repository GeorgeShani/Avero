'use client';

import {
  Button,
  Card,
  Display,
  ItemList,
  notify,
  Segmented,
  TaskStatusBadge,
  TextField,
} from '@avero/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSim } from '../lib/sim/provider';
import { activeStates, elapsed, eventTime } from '../lib/sim/store';

const filters = ['All', 'Active', 'Approval', 'Done', 'Failed'] as const;
type Filter = (typeof filters)[number];

export function TasksBoard() {
  const router = useRouter();
  const { state, approve, retry, cancel } = useSim();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState(state.tasks[0]?.id ?? '');

  const rows = state.tasks.filter((task) => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Active' && activeStates.includes(task.status)) ||
      (filter === 'Approval' && task.status === 'awaiting-approval') ||
      (filter === 'Done' && task.status === 'completed') ||
      (filter === 'Failed' && (task.status === 'failed' || task.status === 'cancelled'));
    const text = `${task.title} ${task.repo} ${task.agent}`.toLowerCase();
    return matchesFilter && text.includes(query.trim().toLowerCase());
  });
  const chosen = rows.find((task) => task.id === chosenId) ?? rows[0];

  return (
    <div data-columns>
      <Card
        title="Tasks"
        description="Filter, search, then open one."
        action={
          <Link data-kit="button" data-tone="primary" href="/tasks/new">
            New task
          </Link>
        }
      >
        <div data-stack>
          <Segmented
            label="Show"
            options={[...filters]}
            defaultValue="All"
            onValueChange={(value) => setFilter(value as Filter)}
          />
          <TextField
            label="Search"
            value={query}
            onValueChange={setQuery}
            placeholder="title, repository or agent"
          />
          {rows.length === 0 ? (
            <p data-note>No tasks match.</p>
          ) : (
            <ItemList
              label="Tasks"
              rows={rows}
              rowKey={(row) => row.id}
              value={chosen?.id ?? ''}
              onValueChange={setChosenId}
              columns={[
                {
                  key: 'title',
                  label: 'Task',
                  width: 'minmax(0, 1.5fr)',
                  render: (row) => row.title,
                },
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
                  render: (row) => elapsed(row, state.tick),
                },
              ]}
            />
          )}
        </div>
      </Card>

      <Card
        title={chosen ? chosen.id : 'No task'}
        description={chosen ? `${chosen.repo} · ${chosen.agent}` : 'Choose a task from the list.'}
        action={chosen ? <TaskStatusBadge state={chosen.status} /> : undefined}
        footer={
          chosen ? (
            <div data-row>
              <Button tone="primary" onClick={() => router.push(`/tasks/${chosen.id}`)}>
                Open
              </Button>
              {chosen.status === 'awaiting-approval' && (
                <Button
                  onClick={() => {
                    approve(chosen.id);
                    notify('Approved', { description: chosen.title, duration: 2000 });
                  }}
                >
                  Approve
                </Button>
              )}
              {(chosen.status === 'failed' || chosen.status === 'cancelled') && (
                <Button onClick={() => retry(chosen.id)}>Retry</Button>
              )}
              {activeStates.includes(chosen.status) && chosen.status !== 'awaiting-approval' && (
                <Button onClick={() => cancel(chosen.id)}>Cancel</Button>
              )}
            </div>
          ) : undefined
        }
      >
        {chosen && (
          <Display label="Latest events" aspect="16 / 9">
            <ol data-log>
              {chosen.events.slice(-6).map((event) => (
                <li key={event.id} data-kind={event.kind}>
                  <span>{eventTime(event)}</span>
                  <span>{event.kind}</span>
                  <span>{event.text}</span>
                </li>
              ))}
              {chosen.events.length === 0 && <li>Waiting to start…</li>}
            </ol>
          </Display>
        )}
      </Card>
    </div>
  );
}
