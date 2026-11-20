import {
  describeToolCall,
  toolSpans,
  type RunRecord,
  type RunStatus,
  type ToolKind,
} from '@avero/contracts';

export type LaneKind = ToolKind | 'thinking';

export type Bar = {
  id: string;
  start: number;
  end: number;
  label: string;
  failed: boolean;
};

export type Lane = { kind: LaneKind; label: string; bars: Bar[] };

const laneOrder: { kind: LaneKind; label: string }[] = [
  { kind: 'thinking', label: 'thinking' },
  { kind: 'read', label: 'read' },
  { kind: 'search', label: 'search' },
  { kind: 'edit', label: 'edit' },
  { kind: 'shell', label: 'shell' },
  { kind: 'other', label: 'other' },
];

/** The length of the run in milliseconds, which is the width of the timeline. */
export function runLength(record: RunRecord): number {
  return Math.max(record.finished?.durationMs ?? 0, record.events.at(-1)?.t ?? 0, 1);
}

/** One lane per kind of work, with a bar for each tool call or stretch of thinking. */
export function buildLanes(record: RunRecord): Lane[] {
  const byKind = new Map<LaneKind, Bar[]>();
  const add = (kind: LaneKind, bar: Bar) => byKind.set(kind, [...(byKind.get(kind) ?? []), bar]);

  for (const span of toolSpans(record)) {
    add(span.kind, {
      id: span.callId,
      start: span.start,
      end: Math.max(span.end, span.start + 1),
      label: describeToolCall(span.name, span.args),
      failed: span.status === 'error',
    });
  }
  record.events.forEach((event, index) => {
    if (event.type !== 'thinking' || !event.durationMs) return;
    add('thinking', {
      id: `thinking-${index}`,
      start: Math.max(0, event.t - event.durationMs),
      end: event.t,
      label: 'thinking',
      failed: false,
    });
  });
  return laneOrder
    .filter((lane) => byKind.has(lane.kind))
    .map((lane) => ({ ...lane, bars: byKind.get(lane.kind) ?? [] }));
}

export type FeedRow = {
  id: string;
  t: number;
  kind: 'tool' | 'assistant' | 'thinking' | 'status' | 'note';
  title: string;
  detail?: string;
  failed?: boolean;
  /** Milliseconds a tool call took. */
  took?: number;
};

/** What the replay shows as it goes: one row per tool call, message, stretch of thinking or note. */
export function buildFeed(record: RunRecord): FeedRow[] {
  const rows: FeedRow[] = [];
  for (const span of toolSpans(record)) {
    rows.push({
      id: span.callId,
      t: span.start,
      kind: 'tool',
      title: describeToolCall(span.name, span.args),
      failed: span.status === 'error',
      took: Math.max(0, span.end - span.start),
    });
  }
  record.events.forEach((event, index) => {
    const id = `e${index}`;
    if (event.type === 'assistant') {
      rows.push({ id, t: event.t, kind: 'assistant', title: 'Agent', detail: event.text });
    } else if (event.type === 'thinking') {
      rows.push({
        id,
        t: event.t,
        kind: 'thinking',
        title: 'Thinking',
        ...(event.text ? { detail: event.text } : {}),
        ...(event.durationMs ? { took: event.durationMs } : {}),
      });
    } else if (event.type === 'status') {
      rows.push({ id, t: event.t, kind: 'status', title: event.status.toLowerCase() });
    } else if (event.type === 'note') {
      rows.push({ id, t: event.t, kind: 'note', title: event.text });
    }
  });
  return rows.sort((a, b) => a.t - b.t);
}

/** Tokens used by a moment in the run: the latest usage report at or before it. */
export function tokensAt(record: RunRecord, t: number): number {
  if (record.finished && t >= record.finished.t) return record.finished.usage?.totalTokens ?? 0;
  let total = 0;
  for (const event of record.events) {
    if (event.t > t) break;
    if (event.type === 'usage') total = event.usage.totalTokens;
  }
  return total;
}

export type PatchLine = { kind: 'add' | 'del' | 'ctx' | 'hunk' | 'meta'; text: string };
export type FilePatch = { path: string; lines: PatchLine[] };

/** Splits a unified diff into one block per file. */
export function splitPatch(patch: string | undefined): FilePatch[] {
  if (!patch) return [];
  const files: FilePatch[] = [];
  let current: FilePatch | undefined;
  let inHunk = false;
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(raw);
      current = { path: match?.[2] ?? raw.slice(11), lines: [] };
      files.push(current);
      inHunk = false;
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('@@')) {
      inHunk = true;
      current.lines.push({ kind: 'hunk', text: raw });
    } else if (!inHunk) {
      current.lines.push({ kind: 'meta', text: raw });
    } else if (raw.startsWith('+')) {
      current.lines.push({ kind: 'add', text: raw });
    } else if (raw.startsWith('-')) {
      current.lines.push({ kind: 'del', text: raw });
    } else if (raw !== '' || current.lines.at(-1)?.kind !== 'ctx') {
      current.lines.push({ kind: 'ctx', text: raw });
    }
  }
  return files.map((file) => ({
    ...file,
    lines: file.lines.filter(
      (line, index, all) => !(line.kind === 'ctx' && line.text === '' && index === all.length - 1),
    ),
  }));
}

export type DisplayStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Maps a run's status to the console's status badge. */
export function badgeState(status: RunStatus | 'RUNNING'): DisplayStatus {
  switch (status) {
    case 'RUNNING':
      return 'running';
    case 'FINISHED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'failed';
  }
}

export function formatClock(ms: number): string {
  const whole = Math.max(0, ms) / 1000;
  const minutes = Math.floor(whole / 60);
  const seconds = Math.floor(whole % 60);
  const tenths = Math.floor((whole * 10) % 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

export function formatMoney(cents: number | undefined): string {
  if (cents === undefined) return 'not reported';
  return `$${(cents / 100).toFixed(cents < 100 ? 3 : 2)}`;
}
