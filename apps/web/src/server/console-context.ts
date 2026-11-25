import 'server-only';

import { writeLog } from '@avero/observability';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { HostedState } from '../features/console-shell/hosted';
import { pickWorkspace, workspaceCookie } from '../features/console-shell/workspace-pick';
import { awaitingDecision } from '../features/review/queue';
import { summarizeWorkspace, type WorkspaceSummary } from '../features/overview/workspace-summary';
import { loadSuites } from './bench';
import { loadRuns } from './runs';
import { resolveRunsDir } from './runs-dir';
import { workspaceRunSource } from './run-source';
import { taskDeps } from './tasks';
import { queryWorkspaces, workspaceSession } from './workspaces';

/** The workspace this browser last chose, if any. Only a hint: it is checked against membership. */
export async function rememberedWorkspace(): Promise<string | undefined> {
  return (await cookies()).get(workspaceCookie)?.value;
}

/** Remembers a workspace choice for a year. The id is only ever used after a membership check. */
export async function rememberWorkspace(id: string): Promise<void> {
  (await cookies()).set(workspaceCookie, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  });
}

// One request asks several times (the sidebar, then the page), so each answer is read once.
const runsOf = cache(async (id: string, name: string) => {
  const { runs } = await workspaceRunSource({ id, name }).listRuns();
  return runs;
});

/**
 * What the shell shows about the team workspace. A failure here must not break the local pages, so
 * it reports the workspace as unavailable and logs the cause.
 */
export const loadHostedState = cache(async (): Promise<HostedState> => {
  try {
    const session = await workspaceSession();
    if (session.status !== 'signed-in') return { status: session.status };
    const workspaces = await queryWorkspaces(session.userId);
    const selected = pickWorkspace(workspaces, await rememberedWorkspace());
    return {
      status: 'signed-in',
      workspaces: workspaces.map(({ id, name }) => ({ id, name })),
      selectedId: selected?.id,
      toDecide: selected ? awaitingDecision(await runsOf(selected.id, selected.name)).length : 0,
    };
  } catch {
    writeLog('error', 'console.hosted_state_failed');
    return { status: 'unavailable' };
  }
});

/** The counts for a workspace's overview, read from its own records. */
export const loadWorkspaceSummary = cache(
  async (id: string, name: string): Promise<WorkspaceSummary> => {
    const deps = taskDeps();
    const [repositories, agents, tasks, runs] = await Promise.all([
      deps.listRepositories(id),
      deps.listAgents(id),
      deps.listTasks(id),
      runsOf(id, name),
    ]);
    return summarizeWorkspace({ repositories, agents, tasks, runs });
  },
);

/** A workspace's runs with their reviews, for pages that show a run's state beside a task. */
export function loadWorkspaceRuns(workspace: { id: string; name: string }) {
  return runsOf(workspace.id, workspace.name);
}

/** A read that failed, as a value, so one unreadable folder cannot take the whole frame down. */
const attempt = <T>(read: Promise<T>) =>
  read.then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );

/**
 * The recordings on this machine, for the sidebar. If the folder cannot be read the frame still
 * draws, with nothing counted and `failed` set, so the shell can say the zeros are not real.
 */
export const loadLocalData = cache(async () => {
  const [runsRead, suitesRead] = await Promise.all([attempt(loadRuns()), attempt(loadSuites())]);
  const failed = !runsRead.ok || !suitesRead.ok;
  if (failed) writeLog('error', 'console.local_read_failed');
  return {
    failed,
    runs: runsRead.ok ? runsRead.value.runs : [],
    dir: runsRead.ok ? runsRead.value.dir : resolveRunsDir(),
    suites: suitesRead.ok ? suitesRead.value.suites : [],
  };
});
