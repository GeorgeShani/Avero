import type { Task, TaskEvent, Workspace } from '@avero/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  createAgentDefinition,
  deleteAgentDefinition,
  deleteRepository,
  launchTask,
  readAgents,
  readTask,
  readTasks,
  registerRepository,
  stopTask,
  taskEventStream,
  updateAgentDefinition,
  type TaskDeps,
} from './task-api';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const repositoryId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';
const agentId = '44444444-4444-4444-8444-444444444444';
const who = { userId: 'user_1', workspaceId };

const workspace = (role: Workspace['role']): Workspace => ({
  id: workspaceId,
  name: 'Team',
  slug: 'team-1',
  role,
});

const task = (status: Task['status'], extra: Partial<Task> = {}): Task => ({
  id: taskId,
  repositoryId,
  agentId: null,
  prompt: 'Do it',
  model: 'composer-2.5',
  status,
  review: false,
  attempt: 1,
  maxTokens: null,
  maxSeconds: null,
  runId: null,
  error: null,
  createdAt: '2026-11-21T10:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  ...extra,
});

function deps(role: Workspace['role'] | undefined, overrides: Partial<TaskDeps> = {}): TaskDeps {
  return {
    findWorkspace: vi.fn().mockResolvedValue(role ? workspace(role) : undefined),
    roots: ['/work/repos'],
    realPath: vi.fn(async (path: string) => path),
    defaultModel: 'composer-2.5',
    listRepositories: vi.fn().mockResolvedValue([]),
    addRepository: vi.fn(async (_id, input) => ({
      id: repositoryId,
      name: input.name,
      kind: 'local' as const,
      createdAt: '2026-11-21T10:00:00.000Z',
    })),
    createTask: vi.fn().mockResolvedValue(task('queued')),
    listTasks: vi.fn().mockResolvedValue([task('queued')]),
    getTask: vi.fn().mockResolvedValue(task('queued')),
    cancelTask: vi.fn().mockResolvedValue(task('cancelled')),
    listEvents: vi.fn().mockResolvedValue([]),
    listAgents: vi.fn().mockResolvedValue([]),
    addAgent: vi.fn(async (_id, input) => ({
      id: agentId,
      ...input,
      createdAt: '2026-11-21T10:00:00.000Z',
    })),
    removeAgent: vi.fn().mockResolvedValue(true),
    updateAgent: vi.fn(async (_id, id, input) => ({
      id,
      ...input,
      createdAt: '2026-11-21T10:00:00.000Z',
    })),
    removeRepository: vi.fn().mockResolvedValue('removed'),
    ...overrides,
  };
}

describe('workspace membership', () => {
  it('answers 404 to a non-member on every operation, without touching storage', async () => {
    const d = deps(undefined);
    const results = await Promise.all([
      readTasks(d, who),
      readTask(d, who, taskId),
      launchTask(d, who, { repositoryId, prompt: 'x' }),
      stopTask(d, who, taskId),
      registerRepository(d, who, { name: 'a', path: '/work/repos/a' }),
      readAgents(d, who),
      createAgentDefinition(d, who, { name: 'a', model: 'm', rules: '' }),
      deleteAgentDefinition(d, who, agentId),
    ]);
    for (const result of results) expect(result.status).toBe(404);
    expect(d.listTasks).not.toHaveBeenCalled();
    expect(d.createTask).not.toHaveBeenCalled();
    expect(d.cancelTask).not.toHaveBeenCalled();
    expect(d.addRepository).not.toHaveBeenCalled();
    expect(d.addAgent).not.toHaveBeenCalled();
    expect(d.removeAgent).not.toHaveBeenCalled();
  });
});

describe('launchTask', () => {
  it('creates a task for a member', async () => {
    const d = deps('member');
    const result = await launchTask(d, who, { repositoryId, prompt: '  fix it ' });
    expect(result.status).toBe(201);
    expect(d.createTask).toHaveBeenCalledWith(
      workspaceId,
      { repositoryId, prompt: 'fix it' },
      'user_1',
    );
  });

  it('refuses a viewer, a malformed body, and a repository that is not in the workspace', async () => {
    expect((await launchTask(deps('viewer'), who, { repositoryId, prompt: 'x' })).status).toBe(403);
    expect((await launchTask(deps('owner'), who, { prompt: 'x' })).status).toBe(400);
    expect(
      (await launchTask(deps('owner'), who, { repositoryId, prompt: 'x', extra: 1 })).status,
    ).toBe(400);
    const missing = deps('owner', { createTask: vi.fn().mockRejectedValue(new Error('no repo')) });
    expect((await launchTask(missing, who, { repositoryId, prompt: 'x' })).status).toBe(400);
  });
});

describe('stopTask and readTask', () => {
  it('cancels for a member and lets a viewer read but not cancel', async () => {
    expect((await stopTask(deps('member'), who, taskId)).status).toBe(200);
    expect((await stopTask(deps('viewer'), who, taskId)).status).toBe(403);
    expect((await readTask(deps('viewer'), who, taskId)).status).toBe(200);
  });

  it('answers 404 for a task that is not in the workspace', async () => {
    const d = deps('owner', {
      getTask: vi.fn().mockResolvedValue(undefined),
      cancelTask: vi.fn().mockResolvedValue(undefined),
    });
    expect((await readTask(d, who, taskId)).status).toBe(404);
    expect((await stopTask(d, who, taskId)).status).toBe(404);
  });
});

describe('registerRepository', () => {
  it('registers a folder inside an allowed root, as its resolved path', async () => {
    const d = deps('admin', { realPath: vi.fn(async () => '/work/repos/demo') });
    const result = await registerRepository(d, who, { name: 'demo', path: '/work/repos/./demo' });
    expect(result.status).toBe(201);
    expect(d.addRepository).toHaveBeenCalledWith(workspaceId, {
      name: 'demo',
      path: '/work/repos/demo',
    });
  });

  it('refuses members, folders outside the roots, and folders that do not exist, with one answer', async () => {
    expect(
      (await registerRepository(deps('member'), who, { name: 'a', path: '/work/repos/a' })).status,
    ).toBe(403);
    const outside = await registerRepository(
      deps('owner', {
        realPath: vi.fn(async (p: string) => (p === '/work/repos' ? p : '/etc')),
      }),
      who,
      { name: 'a', path: '/etc' },
    );
    const missing = await registerRepository(
      deps('owner', { realPath: vi.fn().mockRejectedValue(new Error('ENOENT')) }),
      who,
      { name: 'a', path: '/work/repos/nope' },
    );
    expect(outside).toEqual(missing);
    expect(outside.status).toBe(400);
  });

  it('refuses a symbolic link that leads outside the roots', async () => {
    // The path looks inside the root; its real location is not.
    const d = deps('owner', {
      realPath: vi.fn(async (p: string) => (p === '/work/repos' ? p : '/secrets')),
    });
    const result = await registerRepository(d, who, { name: 'a', path: '/work/repos/link' });
    expect(result.status).toBe(400);
    expect(d.addRepository).not.toHaveBeenCalled();
  });

  it('says so when the server has no folders configured, and on a duplicate name', async () => {
    expect(
      (await registerRepository(deps('owner', { roots: [] }), who, { name: 'a', path: '/x' }))
        .status,
    ).toBe(503);
    const dup = deps('owner', { addRepository: vi.fn().mockRejectedValue(new Error('dup')) });
    expect((await registerRepository(dup, who, { name: 'a', path: '/work/repos/a' })).status).toBe(
      400,
    );
  });
});

describe('taskEventStream', () => {
  const event = (seq: number): TaskEvent => ({
    seq,
    at: '2026-11-21T10:00:00.000Z',
    event: { type: 'note', seq, t: seq, text: `n${seq}` },
  });

  async function collect(stream: AsyncGenerator<string>) {
    const out: string[] = [];
    for await (const chunk of stream) out.push(chunk);
    return out;
  }

  it('sends events in order, then ends with the final status once the task is over', async () => {
    const getTask = vi
      .fn()
      .mockResolvedValueOnce(task('running'))
      .mockResolvedValueOnce(task('finished', { runId: 'run-1' }))
      .mockResolvedValue(task('finished', { runId: 'run-1' }));
    const listEvents = vi
      .fn()
      .mockResolvedValueOnce([event(0), event(1)])
      .mockResolvedValueOnce([event(2)])
      .mockResolvedValue([]);
    const chunks = await collect(
      taskEventStream({ getTask, listEvents }, workspaceId, taskId, { pollMs: 1 }),
    );
    const text = chunks.join('');
    expect(text.indexOf('id: 0')).toBeLessThan(text.indexOf('id: 1'));
    expect(text.indexOf('id: 1')).toBeLessThan(text.indexOf('id: 2'));
    expect(chunks.at(-1)).toBe('event: end\ndata: {"status":"finished","runId":"run-1"}\n\n');
    expect(listEvents).toHaveBeenCalledWith(workspaceId, taskId, 1);
  });

  it('resumes after the last event the client saw', async () => {
    const listEvents = vi.fn().mockResolvedValue([]);
    const getTask = vi.fn().mockResolvedValue(task('failed'));
    await collect(taskEventStream({ getTask, listEvents }, workspaceId, taskId, { after: 41 }));
    expect(listEvents).toHaveBeenCalledWith(workspaceId, taskId, 41);
  });

  it('says the task is missing, and stops when the client goes away', async () => {
    const gone = await collect(
      taskEventStream(
        { getTask: vi.fn().mockResolvedValue(undefined), listEvents: vi.fn() },
        workspaceId,
        taskId,
      ),
    );
    expect(gone).toEqual(['event: end\ndata: {"status":"missing"}\n\n']);

    const controller = new AbortController();
    const stream = taskEventStream(
      {
        getTask: vi.fn().mockResolvedValue(task('running')),
        listEvents: vi.fn().mockResolvedValue([]),
      },
      workspaceId,
      taskId,
      { signal: controller.signal, pollMs: 10_000 },
    );
    const first = await stream.next();
    expect(first.value).toBe(': waiting\n\n');
    controller.abort();
    expect((await stream.next()).done).toBe(true);
  });
});

describe('agent definitions', () => {
  it('lets owners and admins create and delete them, and members only read', async () => {
    for (const role of ['owner', 'admin'] as const) {
      const d = deps(role);
      const created = await createAgentDefinition(d, who, {
        name: 'careful',
        model: 'composer-2.5',
        rules: 'Run the tests.',
      });
      expect(created.status).toBe(201);
      expect((await deleteAgentDefinition(d, who, agentId)).status).toBe(200);
    }
    for (const role of ['member', 'viewer'] as const) {
      const d = deps(role);
      expect((await readAgents(d, who)).status).toBe(200);
      expect(
        (await createAgentDefinition(d, who, { name: 'x', model: 'm', rules: '' })).status,
      ).toBe(403);
      expect((await deleteAgentDefinition(d, who, agentId)).status).toBe(403);
      expect(d.addAgent).not.toHaveBeenCalled();
      expect(d.removeAgent).not.toHaveBeenCalled();
    }
  });

  it('rejects a malformed definition, a duplicate name and an unknown agent', async () => {
    expect((await createAgentDefinition(deps('owner'), who, { name: '', model: 'm' })).status).toBe(
      400,
    );
    expect(
      (
        await createAgentDefinition(deps('owner'), who, {
          name: 'a',
          model: 'm',
          rules: 'x'.repeat(6001),
        })
      ).status,
    ).toBe(400);
    const duplicate = deps('owner', { addAgent: vi.fn().mockRejectedValue(new Error('unique')) });
    expect((await createAgentDefinition(duplicate, who, { name: 'a', model: 'm' })).status).toBe(
      400,
    );
    const missing = deps('owner', { removeAgent: vi.fn().mockResolvedValue(false) });
    expect((await deleteAgentDefinition(missing, who, agentId)).status).toBe(404);
  });
});

describe('editing an agent', () => {
  const edit = { name: 'careful', model: 'composer-2.5', rules: 'Run the tests.' };

  it('lets owners and admins change it, and no one else', async () => {
    for (const role of ['owner', 'admin'] as const) {
      const d = deps(role);
      const result = await updateAgentDefinition(d, who, agentId, edit);
      expect(result.status).toBe(200);
      expect(d.updateAgent).toHaveBeenCalledWith(workspaceId, agentId, edit);
    }
    for (const role of ['member', 'viewer'] as const) {
      const d = deps(role);
      expect((await updateAgentDefinition(d, who, agentId, edit)).status).toBe(403);
      expect(d.updateAgent).not.toHaveBeenCalled();
    }
  });

  it('answers 404 to a non-member, a malformed body, a duplicate name and an unknown agent', async () => {
    expect((await updateAgentDefinition(deps(undefined), who, agentId, edit)).status).toBe(404);
    expect((await updateAgentDefinition(deps('owner'), who, agentId, { name: '' })).status).toBe(
      400,
    );
    const duplicate = deps('owner', {
      updateAgent: vi.fn().mockRejectedValue(new Error('unique')),
    });
    expect((await updateAgentDefinition(duplicate, who, agentId, edit)).status).toBe(400);
    const missing = deps('owner', { updateAgent: vi.fn().mockResolvedValue(undefined) });
    expect((await updateAgentDefinition(missing, who, agentId, edit)).status).toBe(404);
  });
});

describe('removing a repository', () => {
  it('lets owners and admins remove one, and no one else', async () => {
    for (const role of ['owner', 'admin'] as const) {
      const d = deps(role);
      expect((await deleteRepository(d, who, repositoryId)).status).toBe(200);
      expect(d.removeRepository).toHaveBeenCalledWith(workspaceId, repositoryId);
    }
    for (const role of ['member', 'viewer'] as const) {
      const d = deps(role);
      expect((await deleteRepository(d, who, repositoryId)).status).toBe(403);
      expect(d.removeRepository).not.toHaveBeenCalled();
    }
  });

  it('explains why a repository cannot be removed instead of deleting tasks', async () => {
    const inUse = await deleteRepository(
      deps('owner', { removeRepository: vi.fn().mockResolvedValue('in-use') }),
      who,
      repositoryId,
    );
    expect(inUse.status).toBe(400);
    expect(JSON.stringify(inUse.body)).toContain('delete them');

    const github = await deleteRepository(
      deps('owner', { removeRepository: vi.fn().mockResolvedValue('github') }),
      who,
      repositoryId,
    );
    expect(github.status).toBe(400);
    expect(JSON.stringify(github.body)).toContain('GitHub');

    const missing = await deleteRepository(
      deps('owner', { removeRepository: vi.fn().mockResolvedValue('not-found') }),
      who,
      repositoryId,
    );
    expect(missing.status).toBe(404);
    expect((await deleteRepository(deps(undefined), who, repositoryId)).status).toBe(404);
  });
});
