import { parseRunRecord, type RunEvent, type RunRecord } from '@avero/contracts';
import { exampleRunJsonl } from '../../content/example-run';

/** The real recorded run the marketing page replays. */
export const exampleRecord: RunRecord = parseRunRecord(exampleRunJsonl);

export type RecordLine = { type: string; text: string };

const cut = (_key: string, value: unknown) =>
  typeof value === 'string' && value.length > 56 ? `${value.slice(0, 55)}…` : value;

function lineType(event: RunEvent): string {
  switch (event.type) {
    case 'tool':
      return event.name === 'shell' ? 'test' : event.name === 'edit' ? 'edit' : 'tool';
    case 'usage':
      return 'usage';
    case 'run.finished':
      return 'gate';
    default:
      return event.type;
  }
}

/**
 * The record as compact lines for display: one per event, long text cut, without the thinking
 * stretches and the "running" half of each tool call. Past `max` lines it keeps the start and
 * the closing line.
 */
export function recordLinesFrom(record: RunRecord, max = 18): RecordLine[] {
  const events: RunEvent[] = [record.started, ...record.events];
  const lines = events
    .filter(
      (event) =>
        event.type !== 'thinking' && !(event.type === 'tool' && event.status === 'running'),
    )
    .map((event) => {
      const compact: Record<string, unknown> = { ...event };
      delete compact.seq;
      return { type: lineType(event), text: JSON.stringify(compact, cut) };
    });
  const last = lines.at(-1);
  return lines.length <= max || !last ? lines : [...lines.slice(0, max - 1), last];
}
