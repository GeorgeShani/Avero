import { randomUUID } from 'node:crypto';
import type { Workspace } from '@avero/contracts';
import { workspaceEditors } from '@avero/security';
import { and, asc, eq, exists, inArray, sql } from 'drizzle-orm';
import type { AveroDatabase } from './client.ts';
import { users, workspaceMembers, workspaces } from './schema.ts';

const workspaceFields = { id: workspaces.id, name: workspaces.name, slug: workspaces.slug };

function visibleWorkspaces(db: AveroDatabase, clerkUserId: string) {
  return db
    .select({ ...workspaceFields, role: workspaceMembers.role })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(users.clerkUserId, clerkUserId))
    .as('visible_workspaces');
}

export function listWorkspaces(db: AveroDatabase, clerkUserId: string): Promise<Workspace[]> {
  const visible = visibleWorkspaces(db, clerkUserId);
  return db.select().from(visible).orderBy(asc(visible.name), asc(visible.id));
}

export async function readWorkspace(
  db: AveroDatabase,
  clerkUserId: string,
  id: string,
): Promise<Workspace | undefined> {
  const visible = visibleWorkspaces(db, clerkUserId);
  const [workspace] = await db.select().from(visible).where(eq(visible.id, id));
  return workspace;
}

export function createWorkspace(
  db: AveroDatabase,
  identity: { clerkUserId: string; email: string | null },
  name: string,
): Promise<Workspace> {
  const prefix = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 26)
    .replace(/^-+|-+$/g, '');
  const id = randomUUID();
  const slug = `${prefix || 'workspace'}-${id}`;

  return db.transaction(async (transaction) => {
    const [owner] = await transaction
      .insert(users)
      .values(identity)
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: { email: identity.email, updatedAt: sql`now()` },
      })
      .returning({ id: users.id });
    if (!owner) throw new Error('Could not save workspace owner.');

    await transaction.insert(workspaces).values({ id, name, slug, ownerId: owner.id });
    await transaction
      .insert(workspaceMembers)
      .values({ workspaceId: id, userId: owner.id, role: 'owner' });
    return { id, name, slug, role: 'owner' };
  });
}

export async function renameWorkspace(
  db: AveroDatabase,
  clerkUserId: string,
  id: string,
  name: string,
): Promise<boolean> {
  const authorized = db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, id),
        eq(users.clerkUserId, clerkUserId),
        inArray(workspaceMembers.role, workspaceEditors),
      ),
    );
  const [updated] = await db
    .update(workspaces)
    .set({ name, updatedAt: sql`now()` })
    .where(and(eq(workspaces.id, id), exists(authorized)))
    .returning({ id: workspaces.id });
  return updated !== undefined;
}
