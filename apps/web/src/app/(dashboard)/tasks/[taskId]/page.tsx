import { isTerminal, taskSchema } from '@avero/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Note, PageHead, Panel, Stat } from '../../../../components/console/primitives';
import { ReviewPanel } from '../../../../features/review/review-panel';
import { RunView } from '../../../../features/runs/run-view';
import { TaskActions } from '../../../../features/tasks/task-actions';
import { TaskLive } from '../../../../features/tasks/task-live';
import { describeEvent, TaskStatusTag } from '../../../../features/tasks/task-status';
import { openWorkspacePage, setupNeeded } from '../../../../features/workspace-page';
import { seconds, stamp } from '../../../../lib/format';
import { workspaceRunSource } from '../../../../server/run-source';
import { canDecideRuns, canLaunchTasks, taskDeps } from '../../../../server/tasks';
import { decideWorkspaceRun } from './actions';

export const metadata: Metadata = { title: 'Task' };
export const dynamic = 'force-dynamic';

const shorten = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const page = await openWorkspacePage({
    title: 'Task',
    intro: 'One task: what was asked, what the agent did, and the run it recorded.',
    needs: setupNeeded('Tasks'),
  });
  if (!page.open) return page.content;
  const { workspace } = page;

  const taskId = taskSchema.shape.id.safeParse((await params).taskId);
  if (!taskId.success) notFound();
  const deps = taskDeps();
  const task = await deps.getTask(workspace.id, taskId.data);
  if (!task) notFound();

  const [repositories, agents, events] = await Promise.all([
    deps.listRepositories(workspace.id),
    deps.listAgents(workspace.id),
    deps.listEvents(workspace.id, task.id, -1),
  ]);
  const repository = repositories.find((item) => item.id === task.repositoryId);
  const agent = agents.find((item) => item.id === task.agentId);
  const active = !isTerminal(task.status);
  const lines = events.map(describeEvent).filter(Boolean).slice(-200);

  const loaded = task.runId
    ? await workspaceRunSource(workspace)
        .getRun(task.runId)
        .catch(() => undefined)
    : undefined;

  const duration =
    task.startedAt && task.finishedAt
      ? seconds(new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime())
      : active && task.startedAt
        ? 'running'
        : '–';

  return (
    <>
      <PageHead title={shorten(task.prompt, 90)} actions={<TaskStatusTag status={task.status} />}>
        <Link href="/tasks">← All tasks</Link> · launched {stamp(task.createdAt)} UTC
        {task.attempt > 1 ? ` · attempt ${task.attempt}` : ''}
      </PageHead>

      {task.error && (
        <Note tone="bad" title="The task ended with an error.">
          {task.error}
        </Note>
      )}

      <dl data-stats aria-label="This task">
        <Stat label="Repository" value={repository?.name ?? 'removed'} />
        <Stat label="Agent" value={agent?.name ?? 'Default'} note={task.model} />
        <Stat label="Review" value={task.review ? 'Requested' : 'Not requested'} />
        <Stat label="Duration" value={duration} />
      </dl>

      <div data-grid="two">
        <Panel title="Asked of the agent">
          <p data-prose>{task.prompt}</p>
        </Panel>
        <Panel
          title={active ? 'Live' : 'What it did'}
          hint={active ? 'Following the worker as it happens' : 'The last events of the task'}
        >
          <TaskLive
            workspaceId={workspace.id}
            taskId={task.id}
            initial={lines}
            lastSeq={events.at(-1)?.seq ?? -1}
            active={active}
          />
        </Panel>
      </div>

      <TaskActions
        workspaceId={workspace.id}
        task={task}
        canLaunch={canLaunchTasks(workspace.role)}
      />

      {loaded ? (
        <RunView
          loaded={loaded}
          head={false}
          review={
            <ReviewPanel
              runId={loaded.record.started.runId}
              verdict={loaded.verdict}
              decision={loaded.decision}
              readOnly={!canDecideRuns(workspace.role)}
              readOnlyReason="Only owners and admins can decide on runs."
              decide={decideWorkspaceRun.bind(null, workspace.id)}
              noVerdict={
                <p data-dim>
                  {task.review
                    ? 'A review was requested. It appears here once the reviewer has read the run.'
                    : 'No review was requested for this task. Run it again with “Have an independent reviewer check the result” ticked to get one.'}
                </p>
              }
            />
          }
        />
      ) : task.runId ? (
        <Note tone="warn" title="The recorded run could not be read.">
          The task says it produced run {task.runId}, but this workspace has no readable record of
          it.
        </Note>
      ) : active ? (
        <Note>The run is recorded when the task ends, and appears here.</Note>
      ) : (
        <Note>This task ended without recording a run.</Note>
      )}
    </>
  );
}
