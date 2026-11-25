import type { Metadata } from 'next';
import { RepositoriesView } from '../../../features/repositories/repositories-view';
import { openWorkspacePage, setupNeeded } from '../../../features/workspace-page';
import { githubSettings } from '../../../server/github';
import { canManageRepositories, taskDeps } from '../../../server/tasks';

export const metadata: Metadata = { title: 'Repositories' };
export const dynamic = 'force-dynamic';

export default async function RepositoriesPage() {
  const page = await openWorkspacePage({
    title: 'Repositories',
    intro:
      'Where tasks can run: folders on the worker’s machine, and repositories of a connected GitHub App.',
    needs: setupNeeded('Repositories'),
  });
  if (!page.open) return page.content;
  const { workspace } = page;
  const deps = taskDeps();

  return (
    <>
      {page.head}
      <RepositoriesView
        key={workspace.id}
        workspaceId={workspace.id}
        initial={await deps.listRepositories(workspace.id)}
        canManage={canManageRepositories(workspace.role)}
        canRegisterFolders={deps.roots.length > 0}
        githubConnectUrl={
          githubSettings() ? `/api/v1/github/install?workspace=${workspace.id}` : undefined
        }
      />
    </>
  );
}
