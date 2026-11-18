'use client';

import { Button, Card, notify, TaskStatusBadge } from '@avero/ui';
import Link from 'next/link';
import { useSim } from '../lib/sim/provider';

/** Runs waiting for a human decision. Approving here moves the simulated run on. */
export function ApprovalsCard() {
  const { state, approve, reject } = useSim();
  const waiting = state.tasks.filter((task) => task.status === 'awaiting-approval');
  return (
    <Card title="Needs a decision" description={`${waiting.length} waiting · simulated`}>
      {waiting.length === 0 ? (
        <p data-note>No approvals are waiting.</p>
      ) : (
        <ul data-stack style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {waiting.map((task) => (
            <li key={task.id} data-stack>
              <TaskStatusBadge state={task.status} />
              <Link href={`/tasks/${task.id}`}>{task.title}</Link>
              <div data-row>
                <Button
                  tone="primary"
                  onClick={() => {
                    approve(task.id);
                    notify('Approved', { description: task.title, duration: 2000 });
                  }}
                >
                  Approve
                </Button>
                <Button onClick={() => reject(task.id)}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
