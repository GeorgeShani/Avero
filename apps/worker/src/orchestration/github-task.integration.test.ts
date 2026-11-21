import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TaskSource } from '@avero/contracts';
import {
  connectDatabase,
  createTask,
  createWorkspace,
  findGithubRepository,
  getTask,
  linkInstallation,
  setInstallationStatus,
  syncGithubRepositories,
  type AveroDatabase,
} from '@avero/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { processTask } from '../processors/index.ts';
import { fakeAgent, makeRemote, makeRoot, purgeTestData } from '../testing/harness.ts';
import type { GithubAccess } from './checkout.ts';

// Real PostgreSQL and real git, a local bare repository standing in for GitHub, a fake agent.
const url = process.env.AVERO_TEST_DATABASE_URL;

describe.skipIf(!url)('a pull request task through the worker', () => {
  let db: AveroDatabase;
  let root: string;
  let cleanup: () => Promise<void>;
  const clerkId = `test-${randomUUID()}`;
  const installationId = 7_000_000_000 + Math.floor(Math.random() * 1_000_000);
  const secretToken = 'ghs_super_secret_installation_token';

  beforeAll(async () => {
    db = connectDatabase(url as string);
    ({ root, cleanup } = await makeRoot());
  });
  afterAll(async () => {
    await purgeTestData(db, [clerkId]);
    await cleanup();
  });

  async function seed(headSha: string) {
    const workspace = await createWorkspace(
      db,
      { clerkUserId: clerkId, email: null },
      `PR ${randomUUID().slice(0, 6)}`,
    );
    const installation = await linkInstallation(db, workspace.id, {
      installationId: installationId + Math.floor(Math.random() * 1000),
      account: 'acme',
    });
    await syncGithubRepositories(db, installation, [{ fullName: 'acme/api' }]);
    const repo = await findGithubRepository(db, installation.installationId, 'acme/api');
    const source: TaskSource = {
      kind: 'pull_request',
      repository: 'acme/api',
      number: 9,
      headSha,
      baseRef: 'main',
      title: 'The change',
      body: 'Please review.',
      url: 'https://github.com/acme/api/pull/9',
      installationId: installation.installationId,
    };
    const task = await createTask(
      db,
      workspace.id,
      { repositoryId: repo?.id as string, prompt: 'Review pull request #9' },
      { defaultModel: 'composer-2.5', source },
    );
    return { workspace, installation, task, source };
  }

  const access = (bare: string) => {
    const comment = vi.fn().mockResolvedValue(undefined);
    const github: GithubAccess = {
      token: vi.fn().mockResolvedValue(secretToken),
      remoteUrl: () => bare,
      comment,
    };
    return { github, comment };
  };

  it('checks out the pull request commit, keeps the token out of the working copy, and comments on the pull request', async () => {
    const { bare, headSha } = await makeRemote(root, 'api');
    const { workspace, task } = await seed(headSha);
    const { github, comment } = access(bare);
    let sawPrFile = false;
    let config = '';
    const agent = fakeAgent({
      onCreate: async (cwd) => {
        sawPrFile = existsSync(join(cwd, 'PR.md'));
        config = await readFile(join(cwd, '.git', 'config'), 'utf8');
      },
    });

    expect(
      await processTask(task.id, {
        db,
        roots: [root],
        sandbox: false,
        guard: true,
        createAgent: agent.createAgent,
        github,
        heartbeatMs: 100,
      }),
    ).toBe('ran');

    expect(sawPrFile).toBe(true);
    expect(config).not.toContain(secretToken);
    expect(config).not.toContain('x-access-token');
    expect((await getTask(db, workspace.id, task.id))?.status).toBe('finished');

    expect(comment).toHaveBeenCalledTimes(1);
    const [token, repository, number, body] = comment.mock.calls[0] as [
      string,
      string,
      number,
      string,
    ];
    expect([token, repository, number]).toEqual([secretToken, 'acme/api', 9]);
    expect(body).toContain('**Avero review**');
    expect(body).toContain('Finished the task.');
    expect(body).toContain('A person decides');
    expect(body).not.toContain(secretToken);
    expect(agent.seen.cwds[0] && existsSync(agent.seen.cwds[0])).toBe(false);
  });

  it('still finishes the task when the comment cannot be posted', async () => {
    const { bare, headSha } = await makeRemote(root, 'api2');
    const { workspace, task } = await seed(headSha);
    const { github, comment } = access(bare);
    comment.mockRejectedValue(new Error('GitHub is down'));
    await processTask(task.id, {
      db,
      roots: [root],
      sandbox: false,
      createAgent: fakeAgent().createAgent,
      github,
      heartbeatMs: 100,
    });
    expect((await getTask(db, workspace.id, task.id))?.status).toBe('finished');
    expect(comment).toHaveBeenCalled();
  });

  it('fails a GitHub task on a worker that has no GitHub access, without starting the agent', async () => {
    const { headSha } = await makeRemote(root, 'api3');
    const { workspace, task } = await seed(headSha);
    const agent = fakeAgent();
    await processTask(task.id, {
      db,
      roots: [root],
      sandbox: false,
      createAgent: agent.createAgent,
      heartbeatMs: 100,
    });
    const done = await getTask(db, workspace.id, task.id);
    expect(done?.status).toBe('failed');
    expect(done?.error).toMatch(/not set up to reach GitHub/);
    expect(agent.seen.created).toBe(0);
  });

  it('fails a task whose repository the app can no longer reach', async () => {
    const { bare, headSha } = await makeRemote(root, 'api4');
    const { workspace, installation, task } = await seed(headSha);
    await setInstallationStatus(db, installation.installationId, 'removed');
    const { github } = access(bare);
    const agent = fakeAgent();
    await processTask(task.id, {
      db,
      roots: [root],
      sandbox: false,
      createAgent: agent.createAgent,
      github,
      heartbeatMs: 100,
    });
    const done = await getTask(db, workspace.id, task.id);
    expect(done?.status).toBe('failed');
    expect(done?.error).toMatch(/cannot be reached/);
    expect(agent.seen.created).toBe(0);
  });
});
