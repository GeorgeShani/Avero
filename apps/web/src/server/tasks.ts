import 'server-only';
import { realpath } from 'node:fs/promises';
import { readRepositoryRoots } from '@avero/config';
import { workspaceIdSchema } from '@avero/contracts';
import {
  addLocalRepository,
  createAgent,
  createTask,
  deleteAgent,
  getTask,
  listAgents,
  listRepositories,
  listTaskEvents,
  listTasks,
  requestCancel,
} from '@avero/db';
import { canLaunchTasks, canManageAgents, canManageRepositories } from '@avero/security';
import type { TaskDeps } from './task-api';
import { workspaceApiSession, workspaceJson } from './workspace-api';
import { database, queryWorkspace } from './workspaces';

export { canLaunchTasks, canManageAgents, canManageRepositories };

/** The task API's storage, backed by the database. */
export function taskDeps(): TaskDeps {
  const db = database();
  const defaultModel = process.env.AVERO_CURSOR_MODEL?.trim() || 'composer-2.5';
  return {
    findWorkspace: queryWorkspace,
    roots: readRepositoryRoots(process.env),
    realPath: realpath,
    defaultModel,
    listRepositories: (workspaceId) => listRepositories(db, workspaceId),
    addRepository: (workspaceId, input) => addLocalRepository(db, workspaceId, input),
    createTask: (workspaceId, input, userId) =>
      createTask(db, workspaceId, input, { defaultModel, createdBy: { clerkUserId: userId } }),
    listTasks: (workspaceId) => listTasks(db, workspaceId),
    getTask: (workspaceId, taskId) => getTask(db, workspaceId, taskId),
    cancelTask: (workspaceId, taskId) => requestCancel(db, workspaceId, taskId),
    listEvents: (workspaceId, taskId, after) => listTaskEvents(db, workspaceId, taskId, { after }),
    listAgents: (workspaceId) => listAgents(db, workspaceId),
    addAgent: (workspaceId, input) => createAgent(db, workspaceId, input),
    removeAgent: (workspaceId, agentId) => deleteAgent(db, workspaceId, agentId),
  };
}

/** Signed in, and a workspace id that could be one. Anything else is answered here. */
export async function taskContext(params: Promise<{ id: string }>) {
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  const id = workspaceIdSchema.safeParse((await params).id);
  if (!id.success) return workspaceJson({ error: 'Workspace not found' }, 404);
  return { who: { userId: session.userId, workspaceId: id.data }, deps: taskDeps() };
}

/** The JSON body of a request, or the response to send instead. */
export async function jsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json')
    return workspaceJson({ error: 'Expected application/json' }, 415);
  return (await request.json().catch(() => null)) ?? null;
}
