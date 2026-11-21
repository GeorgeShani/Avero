import { Alert, Button, Card, TextField } from '@avero/ui';
import { UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { queryWorkspaces, workspaceSession } from '../../../server/workspaces';
import { createWorkspaceAction } from './actions';

export const metadata: Metadata = { title: 'Workspaces' };

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await workspaceSession();
  if (session.status === 'signed-out') redirect('/sign-in');
  if (session.status === 'unavailable') {
    return (
      <Alert tone="warning" title="Database setup required">
        Configure PostgreSQL and run the workspace migration.
      </Alert>
    );
  }

  const [workspaces, { error }] = await Promise.all([
    queryWorkspaces(session.userId),
    searchParams,
  ]);
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Workspaces</h1>
        </div>
        <UserButton />
      </div>
      <Card title="Your workspaces">
        {workspaces.length === 0 ? (
          <p data-note>You have no workspaces yet. Create one below.</p>
        ) : (
          <ul data-stack style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {workspaces.map(({ id, name, role }) => (
              <li key={id} data-row style={{ justifyContent: 'space-between' }}>
                <Link href={`/workspaces/${id}`}>{name}</Link>
                <span data-kit="badge" data-tone="neutral">
                  {role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Create a workspace">
        <form action={createWorkspaceAction} data-stack aria-label="Create a workspace">
          {error === 'name' && (
            <Alert tone="danger" title="Check the name">
              Enter a workspace name between 1 and 80 characters.
            </Alert>
          )}
          <TextField label="New workspace name" name="name" required maxLength={80} />
          <div>
            <Button tone="primary" type="submit">
              Create workspace
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
