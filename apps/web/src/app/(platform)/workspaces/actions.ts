'use server';

import { workspaceIdSchema, workspaceInputSchema } from '@avero/contracts';
import { notFound, redirect } from 'next/navigation';
import { addWorkspace, updateWorkspace, workspaceSession } from '../../../server/workspaces';

export async function createWorkspaceAction(form: FormData) {
  const session = await workspaceSession();
  if (session.status === 'signed-out') redirect('/sign-in');
  if (session.status !== 'signed-in') redirect('/workspaces');

  const input = workspaceInputSchema.safeParse({ name: form.get('name') });
  if (!input.success) redirect('/workspaces?error=name');
  const workspace = await addWorkspace(session.userId, input.data.name);
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
