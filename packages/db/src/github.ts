import { taskSourceSchema, type TaskSource } from '@avero/contracts';
import { and, eq, sql } from 'drizzle-orm';
import type { AveroDatabase } from './client.ts';
import { githubInstallations, repositories, tasks, webhookDeliveries } from './schema/index.ts';

/**
 * Remembers a webhook delivery. True the first time a delivery id is seen, false when it is a
 * redelivery of one already accepted, which the caller then ignores.
 */
export async function recordDelivery(
  db: AveroDatabase,
  deliveryId: string,
  event: string,
): Promise<boolean> {
  const rows = await db
    .insert(webhookDeliveries)
    .values({ deliveryId, event })
    .onConflictDoNothing()
    .returning({ id: webhookDeliveries.deliveryId });
  return rows.length > 0;
}

export type InstallationRow = {
  id: string;
  workspaceId: string;
  installationId: number;
  status: string;
};

export async function findInstallation(
  db: AveroDatabase,
  installationId: number,
): Promise<InstallationRow | undefined> {
  const [row] = await db
    .select({
      id: githubInstallations.id,
      workspaceId: githubInstallations.workspaceId,
      installationId: githubInstallations.installationId,
      status: githubInstallations.status,
    })
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, installationId));
  return row;
}

/**
 * Attaches an installation to a workspace. Linking again to the same workspace is harmless; an
 * installation that already belongs to a different workspace is refused, so one person cannot
 * take over another workspace's installation by guessing its id.
 */
export async function linkInstallation(
  db: AveroDatabase,
  workspaceId: string,
  input: { installationId: number; account: string | null },
): Promise<InstallationRow> {
  const existing = await findInstallation(db, input.installationId);
  if (existing) {
    if (existing.workspaceId !== workspaceId)
      throw new Error('That installation belongs to another workspace.');
    await db
      .update(githubInstallations)
      .set({ status: 'active', account: input.account })
      .where(eq(githubInstallations.id, existing.id));
    return { ...existing, status: 'active' };
  }
  const [row] = await db
    .insert(githubInstallations)
    .values({ workspaceId, installationId: input.installationId, account: input.account })
    .returning({
      id: githubInstallations.id,
      workspaceId: githubInstallations.workspaceId,
      installationId: githubInstallations.installationId,
      status: githubInstallations.status,
    });
  if (!row) throw new Error('Could not save the installation.');
  return row;
}

/** Suspends, resumes or marks an installation removed. Removed ones keep their history but take no tasks. */
export async function setInstallationStatus(
  db: AveroDatabase,
  installationId: number,
  status: 'active' | 'suspended' | 'removed',
): Promise<void> {
  await db
    .update(githubInstallations)
    .set({ status })
    .where(eq(githubInstallations.installationId, installationId));
}

/**
 * Makes the workspace's list of GitHub repositories match what the installation can reach: new
 * ones are added, known ones are kept (with their tasks), and ones the installation lost are
 * detached, not deleted, so their history stays.
 */
export async function syncGithubRepositories(
  db: AveroDatabase,
  installation: InstallationRow,
  reachable: readonly { fullName: string }[],
): Promise<{ added: number; detached: number }> {
  return db.transaction(async (tx) => {
    const known = await tx
      .select({
        id: repositories.id,
        fullName: repositories.githubFullName,
        installationPk: repositories.installationPk,
      })
      .from(repositories)
      .where(
        and(
          eq(repositories.workspaceId, installation.workspaceId),
          eq(repositories.kind, 'github'),
        ),
      );
    const byName = new Map(known.map((row) => [row.fullName, row]));
    let added = 0;
    for (const repo of reachable) {
      const current = byName.get(repo.fullName);
      if (!current) {
        await tx.insert(repositories).values({
          workspaceId: installation.workspaceId,
          name: repo.fullName,
          kind: 'github',
          githubFullName: repo.fullName,
          installationPk: installation.id,
        });
        added += 1;
      } else if (current.installationPk !== installation.id) {
        await tx
          .update(repositories)
          .set({ installationPk: installation.id })
          .where(eq(repositories.id, current.id));
      }
    }
    const names = new Set(reachable.map((repo) => repo.fullName));
    const lost = known.filter(
      (row) => row.installationPk === installation.id && row.fullName && !names.has(row.fullName),
    );
    for (const row of lost) {
      await tx
        .update(repositories)
        .set({ installationPk: null })
        .where(eq(repositories.id, row.id));
    }
    return { added, detached: lost.length };
  });
}

/** Adds repositories the installation gained, without touching the ones it already had. */
export async function addGithubRepositories(
  db: AveroDatabase,
  installation: InstallationRow,
  fullNames: readonly string[],
): Promise<void> {
  for (const fullName of fullNames) {
    await db
      .insert(repositories)
      .values({
        workspaceId: installation.workspaceId,
        name: fullName,
        kind: 'github',
        githubFullName: fullName,
        installationPk: installation.id,
      })
      .onConflictDoUpdate({
        target: [repositories.workspaceId, repositories.githubFullName],
        set: { installationPk: installation.id },
      });
  }
}

/** Detaches named repositories from an installation (the app was removed from them). */
export async function detachGithubRepositories(
  db: AveroDatabase,
  installation: InstallationRow,
  fullNames: readonly string[],
): Promise<void> {
  for (const fullName of fullNames) {
    await db
      .update(repositories)
      .set({ installationPk: null })
      .where(
        and(
          eq(repositories.workspaceId, installation.workspaceId),
          eq(repositories.githubFullName, fullName),
          eq(repositories.installationPk, installation.id),
        ),
      );
  }
}

/** The repository a pull request belongs to, when its installation is active and reaches it. */
export async function findGithubRepository(
  db: AveroDatabase,
  installationId: number,
  fullName: string,
): Promise<{ id: string; workspaceId: string } | undefined> {
  const [row] = await db
    .select({ id: repositories.id, workspaceId: repositories.workspaceId })
    .from(repositories)
    .innerJoin(githubInstallations, eq(githubInstallations.id, repositories.installationPk))
    .where(
      and(
        eq(githubInstallations.installationId, installationId),
        eq(githubInstallations.status, 'active'),
        eq(repositories.githubFullName, fullName),
      ),
    );
  return row;
}

/** True when a review task for this exact pull request commit already exists. */
export async function hasReviewFor(
  db: AveroDatabase,
  repositoryId: string,
  source: Pick<TaskSource, 'number' | 'headSha'>,
): Promise<boolean> {
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.repositoryId, repositoryId),
        sql`${tasks.source}->>'headSha' = ${source.headSha}`,
        sql`(${tasks.source}->>'number')::int = ${source.number}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export type RepositoryAccess =
  { kind: 'local'; path: string } | { kind: 'github'; fullName: string; installationId: number };

/** How the worker reaches a repository, or undefined when it cannot (missing, or detached). */
export async function repositoryAccess(
  db: AveroDatabase,
  repositoryId: string,
): Promise<RepositoryAccess | undefined> {
  const [row] = await db
    .select({
      kind: repositories.kind,
      path: repositories.path,
      fullName: repositories.githubFullName,
      installationId: githubInstallations.installationId,
      status: githubInstallations.status,
    })
    .from(repositories)
    .leftJoin(githubInstallations, eq(githubInstallations.id, repositories.installationPk))
    .where(eq(repositories.id, repositoryId));
  if (!row) return undefined;
  if (row.kind === 'local') return row.path ? { kind: 'local', path: row.path } : undefined;
  if (!row.fullName || row.installationId === null || row.status !== 'active') return undefined;
  return { kind: 'github', fullName: row.fullName, installationId: row.installationId };
}

export { taskSourceSchema };
