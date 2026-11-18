import type { Metadata } from 'next';
import { TasksBoard } from '../../../components/tasks-board';

export const metadata: Metadata = { title: 'Tasks' };

export default function TasksPage() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Tasks</h1>
          <p>
            Engineering work delegated to agents, with its status and result. Runs are simulated.
          </p>
        </div>
      </div>
      <TasksBoard />
    </>
  );
}
