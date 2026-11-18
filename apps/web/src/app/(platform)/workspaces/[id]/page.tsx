import { workspaceIdSchema } from '@avero/contracts';
import { Alert, Breadcrumb, Button, Card, TextField } from '@avero/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { canEditWorkspace, queryWorkspace, workspaceSession } from '../../../../server/workspaces';
import { renameWorkspaceAction } from '../actions';

export const metadata: Metadata = { title: 'Workspace' };

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
    <>
      <div data-page-head>
        <div>
          <Breadcrumb items={['Workspaces', workspace.name]} />
          <h1>{workspace.name}</h1>
        </div>
        <span data-kit="badge" data-tone="neutral">
          {workspace.role}
        </span>
      </div>
      {canEditWorkspace(workspace.role) && (
        <Card title="Rename workspace">
          <form action={renameWorkspaceAction} data-stack aria-label="Rename workspace">
            <input type="hidden" name="id" value={workspace.id} />
            {error === 'name' && (
              <Alert tone="danger" title="Check the name">
                Enter a workspace name between 1 and 80 characters.
              </Alert>
            )}
            <TextField
              label="Workspace name"
              name="name"
              defaultValue={workspace.name}
              required
              maxLength={80}
            />
            <div>
              <Button tone="primary" type="submit">
                Save name
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
