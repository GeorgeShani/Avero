import Link from 'next/link';
import { Empty, Note, Panel } from '../../components/console/primitives';
import { stamp } from '../../lib/format';
import type { ActivityItem } from '../activity/activity';

const words = {
  launched: { glyph: '○', word: 'Launched', tone: 'quiet' },
  started: { glyph: '◔', word: 'Started', tone: 'warn' },
  finished: { glyph: '✓', word: 'Finished', tone: 'ok' },
  failed: { glyph: '✕', word: 'Failed', tone: 'bad' },
  cancelled: { glyph: '■', word: 'Cancelled', tone: 'quiet' },
} as const;

/** What the workspace's agents have been doing, newest first, built from its tasks. */
export function Timeline({ items }: { items: ActivityItem[] }) {
  return (
    <>
      <Note>
        This is built from the workspace&apos;s tasks. It does not yet record who did what, or
        changes people made to settings.
      </Note>
      <Panel title="Timeline" hint="Newest first" flush>
        {items.length === 0 ? (
          <Empty title="Nothing has happened yet.">
            Launch a task from the Tasks tab and it shows up here.
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
                  <Link href={`/tasks/${item.taskId}`} data-btn>
                    Details
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
