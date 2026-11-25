import {
  agentCreateSchema,
  isTerminal,
  repositoryCreateSchema,
  type Agent,
  taskCreateSchema,
  type Repository,
  type Task,
  type TaskEvent,
  type Workspace,
} from '@avero/contracts';
import {
  canLaunchTasks,
  canManageAgents,
  canManageRepositories,
  pathWithinRoots,
} from '@avero/security';

export type ApiResult<T> =
  { status: 200 | 201; body: T } | { status: 400 | 403 | 404 | 503; body: { error: string } };

/** Everything the task API needs from storage, so the rules can be tested without a database. */
export type TaskDeps = {
  findWorkspace: (userId: string, workspaceId: string) => Promise<Workspace | undefined>;
  /** Folders the worker may use. Empty means repositories cannot be registered. */
  roots: readonly string[];
  /** Resolves symbolic links, so a link inside a root that points outside is not trusted. */
  realPath: (path: string) => Promise<string>;
  defaultModel: string;
  listRepositories: (workspaceId: string) => Promise<Repository[]>;
  addRepository: (
    workspaceId: string,
    input: { name: string; path: string },
  ) => Promise<Repository>;
  createTask: (
    workspaceId: string,
    input: ReturnType<typeof taskCreateSchema.parse>,
    userId: string,
  ) => Promise<Task>;
  listTasks: (workspaceId: string) => Promise<Task[]>;
  getTask: (workspaceId: string, taskId: string) => Promise<Task | undefined>;
  cancelTask: (workspaceId: string, taskId: string) => Promise<Task | undefined>;
  listEvents: (workspaceId: string, taskId: string, after: number) => Promise<TaskEvent[]>;
  listAgents: (workspaceId: string) => Promise<Agent[]>;
  addAgent: (
    workspaceId: string,
    input: ReturnType<typeof agentCreateSchema.parse>,
  ) => Promise<Agent>;
  removeAgent: (workspaceId: string, agentId: string) => Promise<boolean>;
  /** Throws when another agent in the workspace has the name; undefined when there is no such agent. */
  updateAgent: (
    workspaceId: string,
    agentId: string,
    input: ReturnType<typeof agentCreateSchema.parse>,
  ) => Promise<Agent | undefined>;
  removeRepository: (
    workspaceId: string,
    repositoryId: string,
  ) => Promise<'removed' | 'not-found' | 'github' | 'in-use'>;
};

type Who = { userId: string; workspaceId: string };

const notFound = { status: 404, body: { error: 'Workspace not found' } } as const;

/** A workspace the person is not in answers 404, the same as one that does not exist. */
async function member(deps: TaskDeps, who: Who): Promise<Workspace | undefined> {
  return deps.findWorkspace(who.userId, who.workspaceId);
}

export async function readRepositories(deps: TaskDeps, who: Who): Promise<ApiResult<Repository[]>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  return { status: 200, body: await deps.listRepositories(workspace.id) };
}

export async function registerRepository(
  deps: TaskDeps,
  who: Who,
  body: unknown,
): Promise<ApiResult<Repository>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  if (!canManageRepositories(workspace.role))
    return { status: 403, body: { error: 'Only owners and admins can register repositories' } };
  if (deps.roots.length === 0)
    return { status: 503, body: { error: 'This server has no folders set up for repositories' } };

  const parsed = repositoryCreateSchema.safeParse(body);
  if (!parsed.success)
    return {
      status: 400,
      body: { error: 'Send { name, path } as JSON, with a name up to 80 characters' },
    };

  const real = await deps.realPath(parsed.data.path).catch(() => undefined);
  const roots = await Promise.all(deps.roots.map((root) => deps.realPath(root).catch(() => root)));
  // The same answer for "no such folder" and "outside the roots": the response must not tell a
  // caller which folders exist on the server.
  if (!real || !pathWithinRoots(real, roots))
    return { status: 400, body: { error: 'That folder is not one this server allows' } };

  try {
    return {
      status: 201,
      body: await deps.addRepository(workspace.id, { name: parsed.data.name, path: real }),
    };
  } catch {
    return { status: 400, body: { error: 'A repository with that name already exists' } };
  }
}

export async function deleteRepository(
  deps: TaskDeps,
  who: Who,
  repositoryId: string,
): Promise<ApiResult<{ deleted: true }>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  if (!canManageRepositories(workspace.role))
    return { status: 403, body: { error: 'Only owners and admins can remove repositories' } };
  const outcome = await deps.removeRepository(workspace.id, repositoryId);
  switch (outcome) {
    case 'removed':
      return { status: 200, body: { deleted: true } };
    case 'not-found':
      return { status: 404, body: { error: 'Repository not found' } };
    case 'github':
      return {
        status: 400,
        body: {
          error: 'This repository comes from the GitHub App. Remove it in GitHub’s settings',
        },
      };
    case 'in-use':
      return {
        status: 400,
        body: { error: 'Tasks have run on this repository, so removing it would delete them' },
      };
  }
}

export async function readTasks(deps: TaskDeps, who: Who): Promise<ApiResult<Task[]>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  return { status: 200, body: await deps.listTasks(workspace.id) };
}

export async function readTask(deps: TaskDeps, who: Who, taskId: string): Promise<ApiResult<Task>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  const task = await deps.getTask(workspace.id, taskId);
  return task ? { status: 200, body: task } : { status: 404, body: { error: 'Task not found' } };
}

export async function launchTask(
  deps: TaskDeps,
  who: Who,
  body: unknown,
): Promise<ApiResult<Task>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  if (!canLaunchTasks(workspace.role))
    return { status: 403, body: { error: 'Your role in this workspace cannot launch tasks' } };
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success)
    return {
      status: 400,
      body: { error: 'Send { repositoryId, prompt } as JSON, with a prompt up to 8000 characters' },
    };
  try {
    return { status: 201, body: await deps.createTask(workspace.id, parsed.data, who.userId) };
  } catch {
    // The one thing that can be wrong with valid input is the repository.
    return {
      status: 400,
      body: { error: 'There is no such repository or agent in this workspace' },
    };
  }
}

export async function stopTask(deps: TaskDeps, who: Who, taskId: string): Promise<ApiResult<Task>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  if (!canLaunchTasks(workspace.role))
    return { status: 403, body: { error: 'Your role in this workspace cannot cancel tasks' } };
  const task = await deps.cancelTask(workspace.id, taskId);
  return task ? { status: 200, body: task } : { status: 404, body: { error: 'Task not found' } };
}

export async function readAgents(deps: TaskDeps, who: Who): Promise<ApiResult<Agent[]>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  return { status: 200, body: await deps.listAgents(workspace.id) };
}

export async function createAgentDefinition(
  deps: TaskDeps,
  who: Who,
  body: unknown,
): Promise<ApiResult<Agent>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  if (!canManageAgents(workspace.role))
    return { status: 403, body: { error: 'Only owners and admins can create agents' } };
  const parsed = agentCreateSchema.safeParse(body);
  if (!parsed.success)
    return {
      status: 400,
      body: {
        error: 'Send { name, model, rules } as JSON, with rules up to 6000 characters',
      },
    };
  try {
    return { status: 201, body: await deps.addAgent(workspace.id, parsed.data) };
  } catch {
    return { status: 400, body: { error: 'An agent with that name already exists' } };
  }
}

export async function updateAgentDefinition(
  deps: TaskDeps,
  who: Who,
  agentId: string,
  body: unknown,
): Promise<ApiResult<Agent>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  if (!canManageAgents(workspace.role))
    return { status: 403, body: { error: 'Only owners and admins can edit agents' } };
  const parsed = agentCreateSchema.safeParse(body);
  if (!parsed.success)
    return {
      status: 400,
      body: {
        error: 'Send { name, model, rules } as JSON, with rules up to 6000 characters',
      },
    };
  try {
    const updated = await deps.updateAgent(workspace.id, agentId, parsed.data);
    return updated
      ? { status: 200, body: updated }
      : { status: 404, body: { error: 'Agent not found' } };
  } catch {
    return { status: 400, body: { error: 'An agent with that name already exists' } };
  }
}

export async function deleteAgentDefinition(
  deps: TaskDeps,
  who: Who,
  agentId: string,
): Promise<ApiResult<{ deleted: true }>> {
  const workspace = await member(deps, who);
  if (!workspace) return notFound;
  if (!canManageAgents(workspace.role))
    return { status: 403, body: { error: 'Only owners and admins can delete agents' } };
  return (await deps.removeAgent(workspace.id, agentId))
    ? { status: 200, body: { deleted: true } }
    : { status: 404, body: { error: 'Agent not found' } };
}

/**
 * Follows a task as server-sent events: every event after `after`, as it is stored, then a final
 * `end` event once the task has ended and everything it produced was sent. A comment line goes out
 * on each quiet poll, so a proxy does not close an idle connection. Stops when `signal` aborts.
 */
export async function* taskEventStream(
  deps: Pick<TaskDeps, 'listEvents' | 'getTask'>,
  workspaceId: string,
  taskId: string,
  options: { after?: number; signal?: AbortSignal; pollMs?: number } = {},
): AsyncGenerator<string> {
  let after = options.after ?? -1;
  const pollMs = options.pollMs ?? 1000;
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const signal = options.signal;
      if (signal?.aborted) return resolve();
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });

  while (!options.signal?.aborted) {
    // Look at the task first: if it had ended before this read, the read below sees all its events.
    const task = await deps.getTask(workspaceId, taskId);
    if (!task) {
      yield 'event: end\ndata: {"status":"missing"}\n\n';
      return;
    }
    const events = await deps.listEvents(workspaceId, taskId, after);
    for (const item of events) {
      yield `id: ${item.seq}\nevent: run\ndata: ${JSON.stringify(item)}\n\n`;
      after = item.seq;
    }
    if (isTerminal(task.status) && events.length === 0) {
      yield `event: end\ndata: ${JSON.stringify({ status: task.status, runId: task.runId })}\n\n`;
      return;
    }
    if (events.length === 0) {
      yield ': waiting\n\n';
      await wait(pollMs);
    }
  }
}
