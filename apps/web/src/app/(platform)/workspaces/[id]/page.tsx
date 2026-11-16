import { workspaceIdSchema } from '@avero/contracts';
import { Button } from '@avero/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canEditWorkspace, queryWorkspace, workspaceSession } from '../../../../server/workspaces';
import { renameWorkspaceAction } from '../actions';

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await workspaceSession();
  if (session.status === 'signed-out') redirect('/sign-in');
  if (session.status !== 'signed-in') redirect('/workspaces');

  const id = workspaceIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [workspace, { error }] = await Promise.all([
    queryWorkspace(session.userId, id.data),
    searchParams,
  ]);
  if (!workspace) notFound();

  return (
    <section aria-labelledby="workspace-heading">
      <Link href="/workspaces" className="text-sm text-muted-foreground underline">
        All workspaces
      </Link>
      <h1 id="workspace-heading" className="mt-4 text-3xl font-semibold">
        {workspace.name}
      </h1>
      <p className="mt-2 capitalize text-muted-foreground">{workspace.role}</p>
      {canEditWorkspace(workspace.role) && (
        <form action={renameWorkspaceAction} className="mt-8 grid max-w-md gap-3">
          <input type="hidden" name="id" value={workspace.id} />
          <label htmlFor="workspace-name" className="text-sm font-medium">
            Workspace name
          </label>
          <input
            id="workspace-name"
            name="name"
            defaultValue={workspace.name}
            required
            maxLength={80}
            className="h-9 rounded-md border border-input px-3"
          />
          {error === 'name' && (
            <p role="alert">Enter a workspace name between 1 and 80 characters.</p>
          )}
          <Button type="submit" className="justify-self-start">
            Save name
          </Button>
        </form>
      )}
    </section>
  );
}
