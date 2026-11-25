'use server';

import { workspaceIdSchema, workspaceInputSchema } from '@avero/contracts';
import { notFound, redirect } from 'next/navigation';
import { selectWorkspaceAction } from '../../../features/console-shell/actions';
import { rememberWorkspace } from '../../../server/console-context';
import { addWorkspace, updateWorkspace, workspaceSession } from '../../../server/workspaces';

export async function createWorkspaceAction(form: FormData) {
  const session = await workspaceSession();
  if (session.status === 'signed-out') redirect('/sign-in');
  if (session.status !== 'signed-in') redirect('/workspaces');

  const input = workspaceInputSchema.safeParse({ name: form.get('name') });
  if (!input.success) redirect('/workspaces?error=name');
  const workspace = await addWorkspace(session.userId, input.data.name);
  // A workspace you just made is the one you want to work in next.
  await rememberWorkspace(workspace.id);
  redirect(`/workspaces/${workspace.id}`);
}

export async function renameWorkspaceAction(form: FormData) {
  const session = await workspaceSession();
  if (session.status === 'signed-out') redirect('/sign-in');
  if (session.status !== 'signed-in') redirect('/workspaces');

  const id = workspaceIdSchema.safeParse(form.get('id'));
  if (!id.success) notFound();
  const input = workspaceInputSchema.safeParse({ name: form.get('name') });
  if (!input.success) redirect(`/workspaces/${id.data}?error=name`);
  if (!(await updateWorkspace(session.userId, id.data, input.data.name))) notFound();
  redirect(`/workspaces/${id.data}`);
}

/** Makes this the workspace the console shows, then opens its tasks. */
export async function chooseWorkspaceAction(form: FormData) {
  const id = workspaceIdSchema.safeParse(form.get('id'));
  if (!id.success) notFound();
  await selectWorkspaceAction(id.data);
  redirect('/tasks');
}
