import { z } from 'zod';

/**
 * The run record: what Avero saves for one agent run. It is a JSONL file, one event per line,
 * so it can be read, grepped and shared as plain text. The first line is `run.started`; a run
 * that finished ends with `run.finished`. A file with no `run.finished` is a run that is still
 * going or was cut off.
 */
export const runRecordVersion = 1;

const nonNegativeInt = z.number().int().nonnegative();

export const tokenUsageSchema = z.strictObject({
  inputTokens: nonNegativeInt,
  outputTokens: nonNegativeInt,
  cacheReadTokens: nonNegativeInt,
  cacheWriteTokens: nonNegativeInt,
  totalTokens: nonNegativeInt,
  reasoningTokens: nonNegativeInt.optional(),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export const runStatuses = ['FINISHED', 'ERROR', 'CANCELLED', 'EXPIRED'] as const;
export const runStatusSchema = z.enum(runStatuses);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const liveStatusSchema = z.enum([
  'CREATING',
  'RUNNING',
  'FINISHED',
  'ERROR',
  'CANCELLED',
  'EXPIRED',
]);

/** Every event carries its place in the file and how long after the start it happened. */
const stamp = { seq: nonNegativeInt, t: z.number().nonnegative() };

export const changedFileSchema = z.strictObject({
  path: z.string().min(1).max(1024),
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'untracked']),
  /** Null when git cannot count lines, for example a binary file. */
  additions: nonNegativeInt.nullable(),
  deletions: nonNegativeInt.nullable(),
});
export type ChangedFile = z.infer<typeof changedFileSchema>;

export const changesSchema = z.strictObject({
  files: z.array(changedFileSchema),
  additions: nonNegativeInt,
  deletions: nonNegativeInt,
  patch: z.string().optional(),
  patchTruncated: z.boolean().optional(),
});
export type Changes = z.infer<typeof changesSchema>;

export const runStartedSchema = z.strictObject({
  type: z.literal('run.started'),
  ...stamp,
  v: z.literal(runRecordVersion),
  runId: z.string().min(1).max(128),
  agentId: z.string().max(128).optional(),
  task: z.string().min(1).max(20_000),
  model: z.string().min(1).max(128),
  runtime: z.literal('local'),
  startedAt: z.iso.datetime(),
  /** The folder name only. The full path stays on the machine. */
  workspace: z.string().max(256),
  tools: z.array(z.string().max(64)).max(100).optional(),
  git: z
    .strictObject({
      head: z.string().max(64).optional(),
      /** True when the working tree had uncommitted changes before the run started. */
      dirtyBefore: z.boolean(),
    })
    .optional(),
});

export const statusEventSchema = z.strictObject({
  type: z.literal('status'),
  ...stamp,
  status: liveStatusSchema,
  message: z.string().max(2000).optional(),
});

export const assistantEventSchema = z.strictObject({
  type: z.literal('assistant'),
  ...stamp,
  text: z.string(),
});

export const thinkingEventSchema = z.strictObject({
  type: z.literal('thinking'),
  ...stamp,
  text: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
});

export const toolEventSchema = z.strictObject({
  type: z.literal('tool'),
  ...stamp,
  callId: z.string().min(1).max(256),
  name: z.string().min(1).max(128),
  status: z.enum(['running', 'completed', 'error']),
  args: z.unknown().optional(),
  result: z.unknown().optional(),
  truncated: z
    .strictObject({ args: z.boolean().optional(), result: z.boolean().optional() })
    .optional(),
});

export const usageEventSchema = z.strictObject({
  type: z.literal('usage'),
  ...stamp,
  usage: tokenUsageSchema,
});

export const noteEventSchema = z.strictObject({
  type: z.literal('note'),
  ...stamp,
  text: z.string().max(4000),
});

export const runFinishedSchema = z.strictObject({
  type: z.literal('run.finished'),
  ...stamp,
  status: runStatusSchema,
  result: z.string().optional(),
  error: z.string().max(4000).optional(),
  durationMs: z.number().nonnegative(),
  usage: tokenUsageSchema.optional(),
  /** Billed cost in US cents, when the account reports it. */
  cost: z
    .strictObject({ rawCents: z.number().nonnegative(), chargedCents: z.number().nonnegative() })
    .optional(),
  changes: changesSchema.optional(),
});

export const runEventSchema = z.discriminatedUnion('type', [
  runStartedSchema,
  statusEventSchema,
  assistantEventSchema,
  thinkingEventSchema,
  toolEventSchema,
  usageEventSchema,
  noteEventSchema,
  runFinishedSchema,
]);
export type RunEvent = z.infer<typeof runEventSchema>;
export type RunStarted = z.infer<typeof runStartedSchema>;
export type RunFinished = z.infer<typeof runFinishedSchema>;
export type ToolEvent = z.infer<typeof toolEventSchema>;

export type RunRecord = {
  started: RunStarted;
  /** Every event after `run.started`, in order, including `run.finished`. */
  events: RunEvent[];
  finished?: RunFinished;
};

export class RunRecordError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`);
    this.name = 'RunRecordError';
    this.line = line;
  }
}

/** Reads a run record. A bad line is an error naming the line, never a silent skip. */
export function parseRunRecord(text: string): RunRecord {
  const events: RunEvent[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    if (raw.trim() === '') return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new RunRecordError('not valid JSON', index + 1);
    }
    const parsed = runEventSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new RunRecordError(
        `${issue?.path.join('.') || 'event'}: ${issue?.message ?? 'invalid'}`,
        index + 1,
      );
    }
    events.push(parsed.data);
  });

  const first = events[0];
  if (first?.type !== 'run.started')
    throw new RunRecordError('a run record starts with run.started', 1);
  const rest = events.slice(1);
  const finished = rest.find((event): event is RunFinished => event.type === 'run.finished');
  return finished ? { started: first, events: rest, finished } : { started: first, events: rest };
}

export type ToolKind = 'read' | 'edit' | 'shell' | 'search' | 'other';

const toolKinds: Record<string, ToolKind> = {
  read: 'read',
  ls: 'read',
  readLints: 'read',
  readTodos: 'read',
  grep: 'search',
  glob: 'search',
  semSearch: 'search',
  webSearch: 'search',
  webFetch: 'search',
  edit: 'edit',
  delete: 'edit',
  applyAgentDiff: 'edit',
  shell: 'shell',
};

export function toolKind(name: string): ToolKind {
  return toolKinds[name] ?? 'other';
}

/** A short label for what a tool call did: the file, the command or the pattern. */
export function describeToolCall(name: string, args: unknown): string {
  if (typeof args === 'object' && args !== null) {
    const record = args as Record<string, unknown>;
    for (const key of ['path', 'file', 'filePath', 'command', 'cmd', 'pattern', 'query', 'url']) {
      const value = record[key];
      if (typeof value === 'string' && value) {
        const text = value.replace(/\s+/g, ' ');
        return `${name} ${text.length > 72 ? `${text.slice(0, 71)}…` : text}`;
      }
    }
  }
  return name;
}

export type ToolSpan = {
  callId: string;
  name: string;
  kind: ToolKind;
  /** Milliseconds after the run started. */
  start: number;
  end: number;
  status: 'running' | 'completed' | 'error';
  args?: unknown;
  result?: unknown;
};

/** Pairs each tool call's running and completed events into one span. */
export function toolSpans(record: RunRecord): ToolSpan[] {
  const open = new Map<string, ToolSpan>();
  const spans: ToolSpan[] = [];
  const lastT = record.events.at(-1)?.t ?? 0;
  for (const event of record.events) {
    if (event.type !== 'tool') continue;
    const existing = open.get(event.callId);
    if (!existing) {
      const span: ToolSpan = {
        callId: event.callId,
        name: event.name,
        kind: toolKind(event.name),
        start: event.t,
        end: event.status === 'running' ? lastT : event.t,
        status: event.status,
        ...(event.args !== undefined ? { args: event.args } : {}),
        ...(event.result !== undefined ? { result: event.result } : {}),
      };
      open.set(event.callId, span);
      spans.push(span);
    } else {
      existing.status = event.status;
      if (event.status !== 'running') existing.end = event.t;
      if (event.args !== undefined) existing.args = event.args;
      if (event.result !== undefined) existing.result = event.result;
    }
  }
  return spans;
}

export type RunSummary = {
  runId: string;
  task: string;
  model: string;
  startedAt: string;
  /** RUNNING for a record with no run.finished. */
  status: RunStatus | 'RUNNING';
  durationMs: number;
  totalTokens: number;
  costCents: number | null;
  toolCalls: number;
  filesChanged: number;
  additions: number;
  deletions: number;
};

export function summarizeRun(record: RunRecord): RunSummary {
  const { started, finished } = record;
  const lastUsage = [...record.events].reverse().find((event) => event.type === 'usage');
  const usage = finished?.usage ?? (lastUsage?.type === 'usage' ? lastUsage.usage : undefined);
  return {
    runId: started.runId,
    task: started.task,
    model: started.model,
    startedAt: started.startedAt,
    status: finished?.status ?? 'RUNNING',
    durationMs: finished?.durationMs ?? record.events.at(-1)?.t ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    costCents: finished?.cost?.chargedCents ?? null,
    toolCalls: new Set(
      record.events
        .filter((event): event is ToolEvent => event.type === 'tool')
        .map((event) => event.callId),
    ).size,
    filesChanged: finished?.changes?.files.length ?? 0,
    additions: finished?.changes?.additions ?? 0,
    deletions: finished?.changes?.deletions ?? 0,
  };
}
