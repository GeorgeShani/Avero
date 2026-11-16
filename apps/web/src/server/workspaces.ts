import 'server-only';

import { readClerkEnvironment } from '@avero/config';
import {
  connectDatabase,
  createWorkspace,
  listWorkspaces,
  postgresUrlSchema,
  readWorkspace,
  renameWorkspace,
} from '@avero/db';
import type { AveroDatabase } from '@avero/db';
import { writeLog } from '@avero/observability';
import { canEditWorkspace } from '@avero/security';
import { auth, currentUser } from '@clerk/nextjs/server';

export { canEditWorkspace };

let connection: AveroDatabase | undefined;

export function clerkSettings() {
  return readClerkEnvironment(process.env);
}

export function databaseConfigured() {
  return postgresUrlSchema.safeParse(process.env.DATABASE_URL).success;
}

function database() {
  const url = postgresUrlSchema.parse(process.env.DATABASE_URL);
  connection ??= connectDatabase(url);
  return connection;
}

export async function workspaceSession() {
  if (!clerkSettings() || !databaseConfigured()) return { status: 'unavailable' } as const;
  const session = await auth();
  if (!session.userId) return { status: 'signed-out' } as const;
  return { status: 'signed-in', userId: session.userId } as const;
}

export async function queryWorkspaces(userId: string) {
  return perform('workspace.list_failed', () => listWorkspaces(database(), userId));
}

export async function queryWorkspace(userId: string, id: string) {
  return perform('workspace.read_failed', () => readWorkspace(database(), userId, id));
}

export async function addWorkspace(userId: string, name: string) {
  return perform('workspace.create_failed', async () => {
    const user = await currentUser();
    const email = user?.primaryEmailAddress;
    const workspace = await createWorkspace(
      database(),
      {
        clerkUserId: userId,
        email: email?.verification?.status === 'verified' ? email.emailAddress : null,
      },
      name,
    );
    writeLog('info', 'workspace.created', { workspaceId: workspace.id });
    return workspace;
  });
}

export async function updateWorkspace(userId: string, id: string, name: string) {
  const updated = await perform('workspace.update_failed', () =>
    renameWorkspace(database(), userId, id, name),
  );
  if (updated) writeLog('info', 'workspace.renamed', { workspaceId: id });
  return updated;
}

async function perform<T>(failureEvent: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    writeLog('error', failureEvent);
    throw new Error('Workspace operation failed.');
  }
}
