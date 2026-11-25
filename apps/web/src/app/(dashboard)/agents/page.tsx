import type { Metadata } from 'next';
import { AgentsView } from '../../../features/agents/agents-view';
import { openWorkspacePage, setupNeeded } from '../../../features/workspace-page';
import { canManageAgents, taskDeps } from '../../../server/tasks';

export const metadata: Metadata = { title: 'Agents' };
export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const page = await openWorkspacePage({
    title: 'Agents',
    intro: 'Named setups for tasks: a model, and the rules it follows.',
    needs: setupNeeded('Agents'),
  });
  if (!page.open) return page.content;
  const { workspace } = page;
  const deps = taskDeps();

  return (
    <>
      {page.head}
      <AgentsView
        key={workspace.id}
        workspaceId={workspace.id}
        initial={await deps.listAgents(workspace.id)}
        canManage={canManageAgents(workspace.role)}
        defaultModel={deps.defaultModel}
      />
    </>
  );
}
