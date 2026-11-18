import type { Metadata } from 'next';
import { TaskComposer } from '../../../../components/task-composer';

export const metadata: Metadata = { title: 'New task' };

export default function NewTaskPage() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>New task</h1>
          <p>Choose a repository, describe the work, and set how the agent runs.</p>
        </div>
      </div>
      <TaskComposer />
    </>
  );
}
