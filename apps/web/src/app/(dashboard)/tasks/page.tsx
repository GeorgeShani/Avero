import type { ReviewState } from '@avero/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { taskActivity } from '../../../features/activity/activity';
import { TasksView } from '../../../features/tasks/tasks-view';
import { Timeline } from '../../../features/tasks/timeline';
import { openWorkspacePage, setupNeeded } from '../../../features/workspace-page';
import { loadWorkspaceRuns } from '../../../server/console-context';
import { canLaunchTasks, taskDeps } from '../../../server/tasks';

export const metadata: Metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const page = await openWorkspacePage({
    title: 'Tasks',
    intro:
      'Launch an agent on a repository registered for a workspace, watch it work, and open the run it recorded. Tasks run on the worker, never in your browser.',
    needs: setupNeeded('Tasks', 'A worker and a task queue (Redis) are also needed to run them.'),
  });
  if (!page.open) return page.content;
  const { workspace } = page;
  const timeline = (await searchParams).view === 'timeline';

  const deps = taskDeps();
  const [tasks, repositories, agents, runs] = await Promise.all([
    deps.listTasks(workspace.id),
    deps.listRepositories(workspace.id),
    deps.listAgents(workspace.id),
    // A task's review state is a nicety; if the runs cannot be read, the tasks still show.
    loadWorkspaceRuns(workspace).catch(() => []),
  ]);
  const reviews: Record<string, ReviewState> = {};
  for (const run of runs) reviews[run.runId] = run.review;

  return (
    <>
      {page.head}
      <nav data-tabs aria-label="Tasks views">
        <Link href="/tasks" aria-current={timeline ? undefined : 'page'}>
          Tasks
        </Link>
        <Link href="/tasks?view=timeline" aria-current={timeline ? 'page' : undefined}>
          Timeline
        </Link>
      </nav>
      {timeline ? (
        <Timeline items={taskActivity(tasks)} />
      ) : (
        <TasksView
          key={workspace.id}
          workspaceId={workspace.id}
          repositories={repositories}
          agents={agents}
          initialTasks={tasks}
          reviews={reviews}
          canLaunch={canLaunchTasks(workspace.role)}
        />
      )}
    </>
  );
}
