import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgent, deleteAgent, listAgents } from './agents.ts';
import { connectDatabase, type AveroDatabase } from './client.ts';
import { users, workspaces } from './schema/index.ts';
import { addLocalRepository, claimTask, createTask, getTask } from './tasks.ts';
import { createWorkspace } from './workspaces.ts';

// Real PostgreSQL, like the other database tests: skipped unless AVERO_TEST_DATABASE_URL is set.
const url = process.env.AVERO_TEST_DATABASE_URL;

describe.skipIf(!url)('agent definitions in the database', () => {
  let db: AveroDatabase;
  const clerkIds = [`test-${randomUUID()}`, `test-${randomUUID()}`];
  let a: { id: string };
  let b: { id: string };
  let repoA: string;

  beforeAll(async () => {
    db = connectDatabase(url as string);
    a = await createWorkspace(db, { clerkUserId: clerkIds[0] as string, email: null }, 'Agents A');
    b = await createWorkspace(db, { clerkUserId: clerkIds[1] as string, email: null }, 'Agents B');
    repoA = (await addLocalRepository(db, a.id, { name: 'demo', path: '/work/demo' })).id;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(inArray(workspaces.id, [a.id, b.id]));
    await db.delete(users).where(inArray(users.clerkUserId, clerkIds));
  });

  it('keeps definitions per workspace with unique names', async () => {
    const agent = await createAgent(db, a.id, { name: 'careful', model: 'm-1', rules: 'Test it.' });
    expect((await listAgents(db, a.id)).map((item) => item.name)).toEqual(['careful']);
    expect(await listAgents(db, b.id)).toEqual([]);
    await expect(
      createAgent(db, a.id, { name: 'careful', model: 'm-2', rules: '' }),
    ).rejects.toThrow();
    // Another workspace may use the same name, and cannot delete this one.
    await createAgent(db, b.id, { name: 'careful', model: 'm-1', rules: '' });
    expect(await deleteAgent(db, b.id, agent.id)).toBe(false);
    expect(await listAgents(db, a.id)).toHaveLength(1);
  });

  it('launches a task with the agent: its model, and its rules for the worker', async () => {
    const agent = await createAgent(db, a.id, {
      name: 'rules-agent',
      model: 'agent-model',
      rules: 'Always run the tests.',
    });
    const task = await createTask(
      db,
      a.id,
      { repositoryId: repoA, prompt: 'Do it', agentId: agent.id },
      { defaultModel: 'default-model' },
    );
    expect(task.agentId).toBe(agent.id);
    expect(task.model).toBe('agent-model');

    const claimed = await claimTask(db, task.id);
    expect(claimed?.rules).toBe('Always run the tests.');

    // An explicit model still wins over the agent's.
    const override = await createTask(
      db,
      a.id,
      { repositoryId: repoA, prompt: 'Again', agentId: agent.id, model: 'explicit' },
      { defaultModel: 'default-model' },
    );
    expect(override.model).toBe('explicit');
  });

  it('refuses another workspace’s agent, and keeps a task whose agent is deleted', async () => {
    const other = await createAgent(db, b.id, { name: 'theirs', model: 'm', rules: 'secret' });
    await expect(
      createTask(
        db,
        a.id,
        { repositoryId: repoA, prompt: 'x', agentId: other.id },
        { defaultModel: 'd' },
      ),
    ).rejects.toThrow('no such agent');

    const mine = await createAgent(db, a.id, { name: 'temporary', model: 'm', rules: 'r' });
    const task = await createTask(
      db,
      a.id,
      { repositoryId: repoA, prompt: 'x', agentId: mine.id },
      { defaultModel: 'd' },
    );
    expect(await deleteAgent(db, a.id, mine.id)).toBe(true);
    const after = await getTask(db, a.id, task.id);
    expect(after?.agentId).toBeNull();
    expect((await claimTask(db, task.id))?.rules).toBe('');
  });
});
