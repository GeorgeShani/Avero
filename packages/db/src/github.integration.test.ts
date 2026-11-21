import { randomUUID } from 'node:crypto';
import type { TaskSource } from '@avero/contracts';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase, type AveroDatabase } from './client.ts';
import {
  detachGithubRepositories,
  findGithubRepository,
  hasReviewFor,
  linkInstallation,
  recordDelivery,
  repositoryAccess,
  setInstallationStatus,
  syncGithubRepositories,
} from './github.ts';
import { users, workspaces } from './schema/index.ts';
import { addLocalRepository, claimTask, createTask, listRepositories } from './tasks.ts';
import { createWorkspace } from './workspaces.ts';

// Real PostgreSQL. Skipped unless AVERO_TEST_DATABASE_URL is set.
const url = process.env.AVERO_TEST_DATABASE_URL;

describe.skipIf(!url)('github in the database', () => {
  let db: AveroDatabase;
  const clerkIds = [`test-${randomUUID()}`, `test-${randomUUID()}`];
  let a: { id: string };
  let b: { id: string };
  // GitHub's ids are numbers; keep these unlikely to collide with a real run of the tests.
  const installA = 9_000_000_000 + Math.floor(Math.random() * 1_000_000);
  const installB = installA + 1;

  beforeAll(async () => {
    db = connectDatabase(url as string);
    a = await createWorkspace(db, { clerkUserId: clerkIds[0] as string, email: null }, 'Gh A');
    b = await createWorkspace(db, { clerkUserId: clerkIds[1] as string, email: null }, 'Gh B');
  });
  afterAll(async () => {
    await db.delete(workspaces).where(inArray(workspaces.id, [a.id, b.id]));
    await db.delete(users).where(inArray(users.clerkUserId, clerkIds));
  });

  it('accepts a delivery once and recognises a redelivery', async () => {
    const id = randomUUID();
    expect(await recordDelivery(db, id, 'pull_request')).toBe(true);
    expect(await recordDelivery(db, id, 'pull_request')).toBe(false);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => recordDelivery(db, randomUUID(), 'x')),
    );
    expect(results.every(Boolean)).toBe(true);
    const same = randomUUID();
    const race = await Promise.all(Array.from({ length: 5 }, () => recordDelivery(db, same, 'x')));
    expect(race.filter(Boolean)).toHaveLength(1);
  });

  it('links an installation to one workspace and refuses to move it to another', async () => {
    const first = await linkInstallation(db, a.id, { installationId: installA, account: 'acme' });
    expect(first).toMatchObject({ workspaceId: a.id, installationId: installA, status: 'active' });
    expect(
      await linkInstallation(db, a.id, { installationId: installA, account: 'acme' }),
    ).toMatchObject({ id: first.id });
    await expect(
      linkInstallation(db, b.id, { installationId: installA, account: 'acme' }),
    ).rejects.toThrow(/another workspace/);
  });

  it('syncs repositories: adds new ones, keeps known ones, detaches ones the installation lost', async () => {
    const installation = await linkInstallation(db, a.id, {
      installationId: installA,
      account: 'acme',
    });
    expect(
      await syncGithubRepositories(db, installation, [
        { fullName: 'acme/api' },
        { fullName: 'acme/web' },
      ]),
    ).toEqual({ added: 2, detached: 0 });
    expect(await syncGithubRepositories(db, installation, [{ fullName: 'acme/api' }])).toEqual({
      added: 0,
      detached: 1,
    });
    const listed = await listRepositories(db, a.id);
    expect(
      listed
        .filter((repo) => repo.kind === 'github')
        .map((repo) => repo.name)
        .sort(),
    ).toEqual(['acme/api', 'acme/web']);
    expect(await findGithubRepository(db, installA, 'acme/api')).toBeDefined();
    expect(await findGithubRepository(db, installA, 'acme/web')).toBeUndefined();
    // Back again: reattached, not duplicated.
    expect(
      await syncGithubRepositories(db, installation, [
        { fullName: 'acme/api' },
        { fullName: 'acme/web' },
      ]),
    ).toEqual({ added: 0, detached: 0 });
    expect(await findGithubRepository(db, installA, 'acme/web')).toBeDefined();
    await detachGithubRepositories(db, installation, ['acme/web']);
    expect(await findGithubRepository(db, installA, 'acme/web')).toBeUndefined();
  });

  it('takes no tasks for a suspended or removed installation, or for another installation’s repository', async () => {
    const installation = await linkInstallation(db, a.id, {
      installationId: installA,
      account: 'acme',
    });
    await syncGithubRepositories(db, installation, [{ fullName: 'acme/api' }]);
    expect(await findGithubRepository(db, installA, 'acme/api')).toBeDefined();
    expect(await findGithubRepository(db, installB, 'acme/api')).toBeUndefined();
    await setInstallationStatus(db, installA, 'suspended');
    expect(await findGithubRepository(db, installA, 'acme/api')).toBeUndefined();
    await setInstallationStatus(db, installA, 'active');
    expect(await findGithubRepository(db, installA, 'acme/api')).toBeDefined();
  });

  it('reports how the worker reaches each kind of repository, and nothing for a detached one', async () => {
    const installation = await linkInstallation(db, a.id, {
      installationId: installA,
      account: 'acme',
    });
    await syncGithubRepositories(db, installation, [{ fullName: 'acme/api' }]);
    const repo = await findGithubRepository(db, installA, 'acme/api');
    expect(await repositoryAccess(db, repo?.id as string)).toEqual({
      kind: 'github',
      fullName: 'acme/api',
      installationId: installA,
    });
    const local = await addLocalRepository(db, a.id, {
      name: `local-${randomUUID().slice(0, 6)}`,
      path: '/work/x',
    });
    expect(await repositoryAccess(db, local.id)).toEqual({ kind: 'local', path: '/work/x' });
    await setInstallationStatus(db, installA, 'removed');
    expect(await repositoryAccess(db, repo?.id as string)).toBeUndefined();
    await setInstallationStatus(db, installA, 'active');
  });

  it('remembers which pull request commit a review task was made for, and hands the source to the worker', async () => {
    const installation = await linkInstallation(db, a.id, {
      installationId: installA,
      account: 'acme',
    });
    await syncGithubRepositories(db, installation, [{ fullName: 'acme/api' }]);
    const repo = await findGithubRepository(db, installA, 'acme/api');
    const source: TaskSource = {
      kind: 'pull_request',
      repository: 'acme/api',
      number: 9,
      headSha: 'a'.repeat(40),
      baseRef: 'main',
      title: 'Add retries',
      body: 'Please review.',
      url: 'https://github.com/acme/api/pull/9',
      installationId: installA,
    };
    expect(await hasReviewFor(db, repo?.id as string, source)).toBe(false);
    const task = await createTask(
      db,
      a.id,
      { repositoryId: repo?.id as string, prompt: 'Review it', review: true },
      { defaultModel: 'composer-2.5', source },
    );
    expect(await hasReviewFor(db, repo?.id as string, source)).toBe(true);
    expect(await hasReviewFor(db, repo?.id as string, { ...source, headSha: 'b'.repeat(40) })).toBe(
      false,
    );
    expect(await hasReviewFor(db, repo?.id as string, { ...source, number: 10 })).toBe(false);
    expect((await claimTask(db, task.id))?.source).toEqual(source);
  });
});
