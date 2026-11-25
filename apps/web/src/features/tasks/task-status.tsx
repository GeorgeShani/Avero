import type { Task, TaskEvent } from '@avero/contracts';

/** A task's state in words, a glyph and a tone. The color only backs up the word. */
export const statusWords: Record<Task['status'], { glyph: string; word: string; tone: string }> = {
  queued: { glyph: '○', word: 'Queued', tone: 'quiet' },
  running: { glyph: '◔', word: 'Running', tone: 'warn' },
  cancelling: { glyph: '■', word: 'Stopping', tone: 'warn' },
  finished: { glyph: '✓', word: 'Finished', tone: 'ok' },
  failed: { glyph: '✕', word: 'Failed', tone: 'bad' },
  cancelled: { glyph: '■', word: 'Cancelled', tone: 'quiet' },
};

export function TaskStatusTag({ status }: { status: Task['status'] }) {
  const view = statusWords[status];
  return (
    <span data-tag data-tone={view.tone}>
      <i aria-hidden="true">{view.glyph}</i>
      {view.word}
    </span>
  );
}

/** One line for an event of a task's run, or an empty string for events not worth a line. */
export function describeEvent(item: TaskEvent): string {
  const event = item.event;
  switch (event.type) {
    case 'run.started':
      return `Started ${event.model}`;
    case 'assistant':
      return event.text.replace(/\s+/g, ' ').slice(0, 160);
    case 'tool':
      return event.status === 'running'
        ? `Running ${event.name}…`
        : `${event.name} ${event.status}`;
    case 'run.finished':
      return `Ended: ${event.status.toLowerCase()}`;
    case 'note':
      return event.text;
    case 'gate':
      return `${event.kind} ${event.outcome}`;
    default:
      return '';
  }
}
