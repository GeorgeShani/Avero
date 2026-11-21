import type { Workspace } from '@avero/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Note, PageHead, Panel } from '../components/console/primitives';
import { queryWorkspaces, workspaceSession } from '../server/workspaces';

type Options = {
  /** The page's own path, for the workspace switcher's links. */
  path: string;
  title: string;
  /** Under the title. */
  intro: ReactNode;
  /** What this page needs, said when the server has no Clerk or database. */
  needs: ReactNode;
  searchParams: Promise<{ workspace?: string }>;
};

export type WorkspacePage =
  | { open: false; content: ReactNode }
  | { open: true; workspace: Workspace; head: ReactNode; switcher: ReactNode };

/**
 * What every page of a workspace's data starts with: the title, and an honest answer when the
 * server cannot show the data (no sign-in or database, signed out, no workspace yet). When it can,
 * returns the workspace the person is looking at, picked by `?workspace=` or else the first.
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
  if (session.status === 'unavailable') {
    return closed(
      <Panel title="Needs sign-in and a database">
        <p data-dim>{options.needs}</p>
      </Panel>,
    );
  }
  if (session.status === 'signed-out') {
    return closed(
      <Panel title="Sign in">
        <p data-dim>Sign in to see your workspace&apos;s data.</p>
        <p>
          <Link href="/sign-in" data-btn data-primary>
            Sign in
          </Link>
        </p>
      </Panel>,
    );
  }

  const workspaces = await queryWorkspaces(session.userId);
  const { workspace: wanted } = await options.searchParams;
  const workspace = workspaces.find((item) => item.id === wanted) ?? workspaces[0];
  if (!workspace) {
    return closed(
      <Panel title="No workspace yet">
        <p data-dim>Create a workspace first.</p>
        <p>
          <Link href="/workspaces" data-btn data-primary>
            Open workspaces
          </Link>
        </p>
      </Panel>,
    );
  }

  return {
    open: true,
    workspace,
    head,
    switcher:
      workspaces.length > 1 ? (
        <Note>
          Workspace:{' '}
          {workspaces.map((item) => (
            <Link
              key={item.id}
              href={`${options.path}?workspace=${item.id}`}
              style={{ marginRight: 12, fontWeight: item.id === workspace.id ? 600 : 400 }}
            >
              {item.name}
            </Link>
          ))}
        </Note>
      ) : null,
  };
}
