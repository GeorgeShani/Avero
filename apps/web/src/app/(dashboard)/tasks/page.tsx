import type { Metadata } from 'next';
import { TasksView } from '../../../features/tasks/tasks-view';
import { openWorkspacePage } from '../../../features/workspace-page';
import { canLaunchTasks, taskDeps } from '../../../server/tasks';

export const metadata: Metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const page = await openWorkspacePage({
    title: 'Tasks',
    intro:
      'Launch an agent on a repository registered for a workspace, watch it work, and open the run it recorded. Tasks run on the worker, never in your browser.',
    needs:
      'Tasks belong to a workspace, so they need Clerk (sign-in) and PostgreSQL, and a worker with Redis to run them. None of that is configured on this server. The local console (Runs, Review, Evaluations) works without it. See the development guide for setup.',
  });
  if (!page.open) return page.content;
  const { workspace } = page;

  const deps = taskDeps();
  const [tasks, repositories, agents] = await Promise.all([
    deps.listTasks(workspace.id),
    deps.listRepositories(workspace.id),
    deps.listAgents(workspace.id),
  ]);

  return (
    <>
      {page.head}
      <TasksView
        key={workspace.id}
        workspaceId={workspace.id}
        repositories={repositories}
        agents={agents}
        initialTasks={tasks}
        canLaunch={canLaunchTasks(workspace.role)}
      />
    </>
  );
}
