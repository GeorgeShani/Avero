'use client';

import {
  Alert,
  AlertDialog,
  Breadcrumb,
  Button,
  Card,
  CodeBlock,
  Display,
  Lcd,
  LcdDigits,
  Meter,
  notify,
  Tabs,
  TaskStatusBadge,
} from '@avero/ui';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useSim } from '../lib/sim/provider';
import { activeStates, elapsed, eventTime } from '../lib/sim/store';

const sampleDiff = `src/deliver.ts
- await post(event.url, event.body);
+ await withBackoff(() => post(event.url, event.body), { attempts: 4 });

src/deliver.test.ts
+ it('retries a failed delivery up to four times', async () => {
+   // simulated change: shows the layout, not a real diff
+ });`;

export function TaskWorkspace({ id }: { id: string }) {
  const { state, approve, reject, cancel, retry } = useSim();
  const task = state.tasks.find((candidate) => candidate.id === id);
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [task?.events.length]);

  if (!task) {
    return (
      <Alert tone="warning" title="Task not found">
        This simulated task no longer exists. <Link href="/tasks">Back to tasks</Link>
      </Alert>
    );
  }

  const awaiting = task.status === 'awaiting-approval';
  const live = activeStates.includes(task.status);

  return (
    <>
      <div data-page-head>
        <div>
          <Breadcrumb items={['Tasks', task.id]} />
          <h1>{task.title}</h1>
          <p>
            {task.repo} · {task.agent}
          </p>
        </div>
        <TaskStatusBadge state={task.status} />
      </div>

      <div data-columns="workspace">
        <Card title="Context" description="Simulated run">
          <div data-stack>
            <Lcd tag="Elapsed" size="lg">
              <LcdDigits value={elapsed(task, state.tick)} />
            </Lcd>
            <Meter label="Progress" value={task.progress} />
            <dl data-defs>
              <dt>Mode</dt>
              <dd>{task.mode}</dd>
              <dt>Effort</dt>
              <dd>{task.effort}</dd>
              <dt>Pull request</dt>
              <dd>{task.pullRequest ?? 'none yet'}</dd>
            </dl>
          </div>
        </Card>

        <Card
          title="Activity"
          description="Newest last"
          footer={
            <div data-row>
              {awaiting && (
                <>
                  <Button
                    tone="primary"
                    onClick={() => {
                      approve(task.id);
                      notify('Approved', { description: task.title, duration: 2000 });
                    }}
                  >
                    Approve
                  </Button>
                  <AlertDialog
                    trigger="Reject"
                    title="Reject this change?"
                    description="The simulated run stops and is marked cancelled."
                    confirm="Reject"
                    onConfirm={() => reject(task.id)}
                  />
                </>
              )}
              {live && !awaiting && (
                <AlertDialog
                  trigger="Cancel run"
                  title="Cancel this run?"
                  description="The simulated run stops where it is."
                  confirm="Cancel run"
                  onConfirm={() => cancel(task.id)}
                />
              )}
              {(task.status === 'failed' || task.status === 'cancelled') && (
                <Button tone="primary" onClick={() => retry(task.id)}>
                  Retry
                </Button>
              )}
            </div>
          }
        >
          <Display label="Execution events" aspect="auto">
            <div data-device-scroll>
              <ol data-log aria-live="off">
                {task.events.map((event) => (
                  <li key={event.id} data-kind={event.kind}>
                    <span>{eventTime(event)}</span>
                    <span>{event.kind}</span>
                    <span>{event.text}</span>
                  </li>
                ))}
                {task.events.length === 0 && <li>Waiting to start…</li>}
                <li ref={end} aria-hidden="true" />
              </ol>
            </div>
          </Display>
        </Card>

        <Card title="Results">
          <Tabs
            label="Results"
            items={[
              {
                value: 'changes',
                label: 'Changes',
                body: <CodeBlock language="text" code={sampleDiff} />,
              },
              {
                value: 'tests',
                label: 'Tests',
                body: (
                  <p data-note>
                    {task.events.some((event) => event.kind === 'tests')
                      ? 'Simulated: 14 tests ran, 14 passed.'
                      : 'No tests have run yet.'}
                  </p>
                ),
              },
              {
                value: 'approval',
                label: 'Approval',
                body: (
                  <p data-note>
                    {awaiting
                      ? 'This run is waiting for your decision.'
                      : 'Nothing is waiting for approval.'}
                  </p>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
