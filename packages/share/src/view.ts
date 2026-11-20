import {
  describeToolCall,
  toolSpans,
  type Decision,
  type RunRecord,
  type ToolKind,
  type Verdict,
} from '@avero/contracts';
import { parseUnifiedDiff } from './patch.ts';

/**
 * The data a shared page carries: the run shaped for the replay, so the page itself only has to
 * draw it. Everything here is plain JSON and is inserted into the page as text, never as markup.
 */

export type LaneKind = ToolKind | 'thinking';

export type ViewBar = { start: number; end: number; label: string; failed: boolean };
export type ViewLane = { kind: LaneKind; label: string; bars: ViewBar[] };

export type ViewRow = {
  t: number;
  kind: 'tool' | 'assistant' | 'thinking' | 'status' | 'note' | 'gate';
  title: string;
  detail?: string;
  failed?: boolean;
  /** Milliseconds a tool call or a stretch of thinking took. */
  took?: number;
};

export type ViewFile = {
  path: string;
  status: string;
  additions: number | null;
  deletions: number | null;
};

export type PageData = {
  v: 1;
  runId: string;
  task: string;
  model: string;
  startedAt: string;
  workspace: string;
  status: string;
  /** Milliseconds: the width of the timeline. */
  length: number;
  durationMs: number;
  totalTokens: number;
  /** Billed cost in cents, or null when the account did not report it. */
  costCents: number | null;
  lanes: ViewLane[];
  feed: ViewRow[];
  /** Cumulative token totals as [milliseconds, tokens], in time order. */
  tokens: [number, number][];
  result: string | null;
  error: string | null;
  changes: {
    files: ViewFile[];
    additions: number;
    deletions: number;
    patchTruncated: boolean;
  } | null;
  /** One unified-diff block per file. */
  patches: { path: string; text: string }[];
  verdict: Verdict | null;
  decision: Decision | null;
};

const laneOrder: { kind: LaneKind; label: string }[] = [
  { kind: 'thinking', label: 'thinking' },
  { kind: 'read', label: 'read' },
  { kind: 'search', label: 'search' },
  { kind: 'edit', label: 'edit' },
  { kind: 'shell', label: 'shell' },
  { kind: 'other', label: 'other' },
];

/** Long messages are cut in the page data so one huge tool result cannot bloat a shared file. */
const maxDetail = 6000;

function clip(text: string): string {
  return text.length > maxDetail ? `${text.slice(0, maxDetail)}… (cut)` : text;
}

export function runLength(record: RunRecord): number {
  return Math.max(record.finished?.durationMs ?? 0, record.events.at(-1)?.t ?? 0, 1);
}

function buildLanes(record: RunRecord): ViewLane[] {
  const byKind = new Map<LaneKind, ViewBar[]>();
  const add = (kind: LaneKind, bar: ViewBar) => {
    const bars = byKind.get(kind) ?? [];
    bars.push(bar);
    byKind.set(kind, bars);
  };
  for (const span of toolSpans(record)) {
    add(span.kind, {
      start: span.start,
      end: Math.max(span.end, span.start + 1),
      label: describeToolCall(span.name, span.args),
      failed: span.status === 'error',
    });
  }
  for (const event of record.events) {
    if (event.type !== 'thinking' || !event.durationMs) continue;
    add('thinking', {
      start: Math.max(0, event.t - event.durationMs),
      end: event.t,
      label: 'thinking',
      failed: false,
    });
  }
  return laneOrder
    .filter((lane) => byKind.has(lane.kind))
    .map((lane) => ({ ...lane, bars: byKind.get(lane.kind) ?? [] }));
}

function buildFeed(record: RunRecord): ViewRow[] {
  const rows: ViewRow[] = [];
  for (const span of toolSpans(record)) {
    rows.push({
      t: span.start,
      kind: 'tool',
      title: describeToolCall(span.name, span.args),
      failed: span.status === 'error',
      took: Math.max(0, span.end - span.start),
    });
  }
  for (const event of record.events) {
    if (event.type === 'assistant') {
      rows.push({ t: event.t, kind: 'assistant', title: 'Agent', detail: clip(event.text) });
    } else if (event.type === 'thinking') {
      rows.push({
        t: event.t,
        kind: 'thinking',
        title: 'Thinking',
        ...(event.text ? { detail: clip(event.text) } : {}),
        ...(event.durationMs ? { took: event.durationMs } : {}),
      });
    } else if (event.type === 'status') {
      rows.push({ t: event.t, kind: 'status', title: event.status.toLowerCase() });
    } else if (event.type === 'note') {
      rows.push({ t: event.t, kind: 'note', title: event.text });
    } else if (event.type === 'gate') {
      rows.push({
        t: event.t,
        kind: 'gate',
        title: `${event.kind} ${event.outcome}`,
        ...(event.detail ? { detail: clip(event.detail) } : {}),
        failed: event.outcome === 'denied' || event.outcome === 'tripped',
      });
    }
  }
  // Array.prototype.sort is stable, so rows with the same time keep their order.
  return rows.sort((a, b) => a.t - b.t);
}

export function buildPageData(
  record: RunRecord,
  extras: { verdict?: Verdict | undefined; decision?: Decision | undefined } = {},
): PageData {
  const { started, finished } = record;
  const length = runLength(record);
  const tokens: [number, number][] = [];
  for (const event of record.events) {
    if (event.type === 'usage') tokens.push([event.t, event.usage.totalTokens]);
  }
  const lastTokens = tokens.at(-1)?.[1] ?? 0;
  const changes = finished?.changes;
  return {
    v: 1,
    runId: started.runId,
    task: started.task,
    model: started.model,
    startedAt: started.startedAt,
    workspace: started.workspace,
    status: finished?.status ?? 'RUNNING',
    length,
    durationMs: finished?.durationMs ?? length,
    totalTokens: finished?.usage?.totalTokens ?? lastTokens,
    costCents: finished?.cost?.chargedCents ?? null,
    lanes: buildLanes(record),
    feed: buildFeed(record),
    tokens,
    result: finished?.result ?? null,
    error: finished?.error ?? null,
    changes: changes
      ? {
          files: changes.files.map((file) => ({
            path: file.path,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
          })),
          additions: changes.additions,
          deletions: changes.deletions,
          patchTruncated: changes.patchTruncated ?? false,
        }
      : null,
    patches: parseUnifiedDiff(changes?.patch).map((file) => ({ path: file.path, text: file.text })),
    verdict: extras.verdict ?? null,
    decision: extras.decision ?? null,
  };
}
