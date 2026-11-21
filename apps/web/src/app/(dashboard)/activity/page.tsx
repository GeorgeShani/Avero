import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, Note, Panel } from '../../../components/console/primitives';
import { taskActivity } from '../../../features/activity/activity';
import { openWorkspacePage } from '../../../features/workspace-page';
import { stamp } from '../../../lib/format';
import { taskDeps } from '../../../server/tasks';

export const metadata: Metadata = { title: 'Activity' };
export const dynamic = 'force-dynamic';

const words = {
  launched: { glyph: '○', word: 'Launched', tone: 'quiet' },
  started: { glyph: '◔', word: 'Started', tone: 'warn' },
  finished: { glyph: '✓', word: 'Finished', tone: 'ok' },
  failed: { glyph: '✕', word: 'Failed', tone: 'bad' },
  cancelled: { glyph: '■', word: 'Cancelled', tone: 'quiet' },
} as const;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const page = await openWorkspacePage({
    path: '/activity',
    title: 'Activity',
    intro: 'What the workspace’s agents have been doing, newest first.',
    needs:
      'Activity belongs to a workspace, so it needs Clerk (sign-in) and PostgreSQL. Neither is configured on this server.',
    searchParams,
  });
  if (!page.open) return page.content;

  const items = taskActivity(await taskDeps().listTasks(page.workspace.id));

  return (
    <>
      {page.head}
      {page.switcher}
      <Note>
        This is built from the workspace&apos;s tasks. It does not yet record who did what, or
        changes people made to settings.
      </Note>
      <Panel title="Task activity" flush>
        {items.length === 0 ? (
          <Empty title="Nothing has happened yet.">
            Launch a task on the <Link href={`/tasks?workspace=${page.workspace.id}`}>Tasks</Link>{' '}
            page.
          </Empty>
        ) : (
          <ul data-items>
            {items.map((item) => {
              const view = words[item.kind];
              return (
                <li
                  key={`${item.taskId}-${item.kind}`}
                  style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}
                >
                  <span data-tag data-tone={view.tone}>
                    <i aria-hidden="true">{view.glyph}</i>
                    {view.word}
                  </span>
                  <div data-item-main>
                    <span style={{ fontWeight: 500 }}>{item.prompt}</span>
                    <span data-item-meta>
                      {stamp(item.at)}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </span>
                  </div>
                  {item.runId && (
                    <Link href={`/runs/${item.runId}`} data-btn>
                      Open run
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
