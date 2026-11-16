import { Button } from '@avero/ui';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { queryWorkspaces, workspaceSession } from '../../../server/workspaces';
import { createWorkspaceAction } from './actions';

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await workspaceSession();
  if (session.status === 'signed-out') redirect('/sign-in');
  if (session.status === 'unavailable') {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Database setup required</h1>
        <p className="mt-2 text-muted-foreground">
          Configure PostgreSQL and run the workspace migration.
        </p>
      </section>
    );
  }

  const [workspaces, { error }] = await Promise.all([
    queryWorkspaces(session.userId),
    searchParams,
  ]);
  return (
    <section aria-labelledby="workspaces-heading">
      <header className="flex items-center justify-between">
        <h1 id="workspaces-heading" className="text-3xl font-semibold">
          Workspaces
        </h1>
        <UserButton />
      </header>
      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {workspaces.length === 0 && (
          <li className="p-4 text-muted-foreground">You have no workspaces yet.</li>
        )}
        {workspaces.map(({ id, name, role }) => (
          <li key={id}>
            <Link
              href={`/workspaces/${id}`}
              className="flex justify-between gap-4 p-4 hover:bg-muted"
            >
              <span>{name}</span>
              <span className="text-sm capitalize text-muted-foreground">{role}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={createWorkspaceAction} className="mt-8 grid max-w-md gap-3">
        <label htmlFor="workspace-name" className="text-sm font-medium">
          New workspace name
        </label>
        <input
          id="workspace-name"
          name="name"
          required
          maxLength={80}
          className="h-9 rounded-md border border-input px-3"
        />
        {error === 'name' && (
          <p role="alert">Enter a workspace name between 1 and 80 characters.</p>
        )}
        <Button type="submit" className="justify-self-start">
          Create workspace
        </Button>
      </form>
    </section>
  );
}
