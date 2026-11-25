import { workspaceIdSchema } from '@avero/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Note, PageHead, Panel } from '../../../../components/console/primitives';
import { pickWorkspace } from '../../../../features/console-shell/workspace-pick';
import { rememberedWorkspace } from '../../../../server/console-context';
import {
  canEditWorkspace,
  queryWorkspace,
  queryWorkspaces,
  workspaceSession,
} from '../../../../server/workspaces';
import { chooseWorkspaceAction, renameWorkspaceAction } from '../actions';

export const metadata: Metadata = { title: 'Workspace' };
export const dynamic = 'force-dynamic';

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
  const [workspace, all, { error }, remembered] = await Promise.all([
    queryWorkspace(session.userId, id.data),
    queryWorkspaces(session.userId),
    searchParams,
    rememberedWorkspace(),
  ]);
  if (!workspace) notFound();
  const isCurrent = pickWorkspace(all, remembered)?.id === workspace.id;

  return (
    <>
      <PageHead
        title={workspace.name}
        actions={
          isCurrent ? (
            <span data-tag data-tone="ok">
              <i aria-hidden="true">✓</i>
              Current
            </span>
          ) : (
            <form action={chooseWorkspaceAction}>
              <input type="hidden" name="id" value={workspace.id} />
              <button type="submit" data-btn data-primary>
                Use this workspace
              </button>
            </form>
          )
        }
      >
        Your role here: {workspace.role}.
      </PageHead>

      <Panel
        title="Set it up"
        hint={isCurrent ? 'These pages now show this workspace' : 'Use this workspace first'}
      >
        <ol data-setup-steps>
          <li>
            <Link href="/repositories">Add a repository</Link> so tasks have somewhere to run.
          </li>
          <li>
            <Link href="/agents">Create an agent</Link> if you want a model or rules other than the
            server&apos;s defaults.
          </li>
          <li>
            <Link href="/tasks">Launch a task</Link> and open the run it records.
          </li>
        </ol>
      </Panel>

      {canEditWorkspace(workspace.role) && (
        <Panel title="Rename workspace">
          <form action={renameWorkspaceAction} data-stack aria-label="Rename workspace">
            <input type="hidden" name="id" value={workspace.id} />
            {error === 'name' && (
              <Note tone="bad" title="Check the name.">
                Enter a workspace name between 1 and 80 characters.
              </Note>
            )}
            <input
              data-field
              name="name"
              aria-label="Workspace name"
              defaultValue={workspace.name}
              required
              maxLength={80}
            />
            <div>
              <button type="submit" data-btn data-primary>
                Save name
              </button>
            </div>
          </form>
        </Panel>
      )}
    </>
  );
}
