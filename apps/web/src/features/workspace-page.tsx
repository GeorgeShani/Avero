import type { Workspace } from '@avero/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Panel, PageHead } from '../components/console/primitives';
import { rememberedWorkspace } from '../server/console-context';
import { queryWorkspaces, workspaceSession } from '../server/workspaces';
import { pickWorkspace } from './console-shell/workspace-pick';

type Options = {
  title: string;
  /** Under the title. */
  intro: ReactNode;
  /** What this page needs, said when the server has no Clerk or database. */
  needs: ReactNode;
};

export type WorkspacePage =
  { open: false; content: ReactNode } | { open: true; workspace: Workspace; head: ReactNode };

/** What a workspace page says when the server cannot show a workspace at all. */
export function workspaceGate(status: 'unavailable' | 'signed-out', needs: ReactNode): ReactNode {
  if (status === 'unavailable') {
    return (
      <Panel title="Needs sign-in and a database">
        <p data-dim>{needs}</p>
      </Panel>
    );
  }
  return (
    <Panel title="Sign in">
      <p data-dim>Sign in to see your workspace&apos;s data.</p>
      <p>
        <Link href="/sign-in" data-btn data-primary>
          Sign in
        </Link>
      </p>
    </Panel>
  );
}

/**
 * What every page of a workspace's data starts with: the title, and an honest answer when the
 * server cannot show the data (no sign-in or database, signed out, no workspace yet). When it can,
 * returns the workspace the person chose in the sidebar, or else their first.
 */
export async function openWorkspacePage(options: Options): Promise<WorkspacePage> {
  const head = <PageHead title={options.title}>{options.intro}</PageHead>;
  const closed = (content: ReactNode): WorkspacePage => ({
    open: false,
    content: (
      <>
        {head}
        {content}
      </>
    ),
  });

  const session = await workspaceSession();
  if (session.status !== 'signed-in') return closed(workspaceGate(session.status, options.needs));

  const workspaces = await queryWorkspaces(session.userId);
  const workspace = pickWorkspace(workspaces, await rememberedWorkspace());
  if (!workspace) {
    return closed(
      <Panel title="No workspace yet">
        <p data-dim>
          A workspace holds a team&apos;s repositories, agents and tasks. Create one to continue.
        </p>
        <p>
          <Link href="/workspaces" data-btn data-primary>
            Create a workspace
          </Link>
        </p>
      </Panel>,
    );
  }

  return { open: true, workspace, head };
}
