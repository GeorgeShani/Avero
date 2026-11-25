import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Empty, Note, PageHead, Panel } from '../../../components/console/primitives';
import { pickWorkspace } from '../../../features/console-shell/workspace-pick';
import { setupNeeded, workspaceGate } from '../../../features/workspace-page';
import { rememberedWorkspace } from '../../../server/console-context';
import { queryWorkspaces, workspaceSession } from '../../../server/workspaces';
import { chooseWorkspaceAction, createWorkspaceAction } from './actions';

export const metadata: Metadata = { title: 'Workspaces' };
export const dynamic = 'force-dynamic';

const intro =
  'A workspace holds a team’s repositories, agents and tasks. The console shows one workspace at a time; pick it here or in the sidebar.';

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await workspaceSession();
  if (session.status === 'signed-out') redirect('/sign-in');
  const head = <PageHead title="Workspaces">{intro}</PageHead>;
  if (session.status === 'unavailable') {
    return (
      <>
        {head}
        {workspaceGate('unavailable', setupNeeded('Workspaces'))}
      </>
    );
  }

  const [workspaces, { error }, remembered] = await Promise.all([
    queryWorkspaces(session.userId),
    searchParams,
    rememberedWorkspace(),
  ]);
  const current = pickWorkspace(workspaces, remembered)?.id;

  return (
    <>
      {head}
      <Panel title="Your workspaces" flush>
        {workspaces.length === 0 ? (
          <Empty title="You have no workspace yet.">Create one below to get started.</Empty>
        ) : (
          <ul data-items>
            {workspaces.map(({ id, name, role }) => (
              <li key={id} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}>
                <div data-item-main>
                  <Link href={`/workspaces/${id}`} style={{ fontWeight: 500 }}>
                    {name}
                  </Link>
                  <span data-item-meta>Your role: {role}</span>
                </div>
                {id === current ? (
                  <span data-tag data-tone="ok">
                    <i aria-hidden="true">✓</i>
                    Current
                  </span>
                ) : (
                  <span />
                )}
                {id === current ? null : (
                  <form action={chooseWorkspaceAction}>
                    <input type="hidden" name="id" value={id} />
                    <button type="submit" data-btn>
                      Use this workspace
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Create a workspace" hint="You become its owner">
        <form action={createWorkspaceAction} data-stack aria-label="Create a workspace">
          {error === 'name' && (
            <Note tone="bad" title="Check the name.">
              Enter a workspace name between 1 and 80 characters.
            </Note>
          )}
          <input
            data-field
            name="name"
            aria-label="New workspace name"
            placeholder="Name, for example Platform team"
            required
            maxLength={80}
          />
          <div>
            <button type="submit" data-btn data-primary>
              Create workspace
            </button>
          </div>
        </form>
      </Panel>
    </>
  );
}
