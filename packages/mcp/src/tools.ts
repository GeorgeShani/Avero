import {
  commandsRun,
  describeToolCall,
  summarizeRun,
  type RunEvent,
  type RunRecord,
} from '@avero/contracts';
import { isRunId, listRuns, readDecision, readRun, readVerdict } from '@avero/run-store';
import { parseUnifiedDiff } from '@avero/share';
import { z } from 'zod';

/**
 * What the MCP tools do, apart from the protocol. Each function reads the runs folder, shapes a
 * small answer and returns plain data. A problem the caller can fix, such as an unknown run id,
 * is a `ToolError`; the server turns it into an MCP tool error. Nothing here writes to disk.
 */

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

const runId = z
  .string()
  .min(1)
  .max(128)
  .refine(isRunId, 'Not a valid run id. Use an id from list_runs, for example run-mwp9tbas.')
  .describe('The run id, as list_runs shows it.');

export const eventsPageDefault = 50;
export const eventsPageMax = 200;
/** Long text is cut to this many characters in lists, so one big tool result cannot fill a context. */
export const textLimit = 500;
export const patchLimit = 20_000;
export const resultLimit = 4000;

export const inputs = {
  list_runs: {
    limit: z.number().int().min(1).max(200).default(50).describe('How many runs, newest first.'),
  },
  get_run: { run_id: runId },
  get_run_events: {
    run_id: runId,
    offset: z.number().int().min(0).default(0).describe('Index of the first event to return.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(eventsPageMax)
      .default(eventsPageDefault)
      .describe(`How many events, at most ${eventsPageMax}.`),
  },
  get_verdict: { run_id: runId },
  get_changes: {
    run_id: runId,
    path: z
      .string()
      .min(1)
      .max(1024)
      .optional()
      .describe('A changed file, as get_changes lists it. Give it to get that file’s patch.'),
  },
  search_runs: {
    query: z.string().trim().min(1).max(200).describe('Text to find, case-insensitive.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('How many matching runs, newest first.'),
  },
} as const;

type Input<K extends keyof typeof inputs> = z.infer<z.ZodObject<(typeof inputs)[K]>>;

function cut(text: string, max: number): { text: string; cut: boolean } {
  return text.length > max ? { text: `${text.slice(0, max)}…`, cut: true } : { text, cut: false };
}

/** A field cut to a length, with `<field>Cut: true` beside it when text was dropped. */
function clip(field: string, text: string, max = textLimit): Record<string, string | boolean> {
  const result = cut(text, max);
  return { [field]: result.text, ...(result.cut ? { [`${field}Cut`]: true } : {}) };
}

async function load(dir: string, id: string): Promise<RunRecord> {
  try {
    return await readRun(dir, id);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ToolError(`There is no run with id ${id}. Call list_runs to see the ids.`);
    }
    throw new ToolError(
      `The record for ${id} could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

export async function listRunsTool(dir: string, input: Input<'list_runs'>) {
  const { runs, problems } = await listRuns(dir);
  return {
    total: runs.length,
    runs: runs.slice(0, input.limit).map((run) => ({
      runId: run.runId,
      task: cut(run.task.replace(/\s+/g, ' '), 200).text,
      status: run.status,
      model: run.model,
      startedAt: run.startedAt,
      durationMs: run.durationMs,
      totalTokens: run.totalTokens,
      filesChanged: run.filesChanged,
      additions: run.additions,
      deletions: run.deletions,
      risk: run.review.risk ?? null,
      failedChecks: run.review.failedChecks ?? null,
      decision: run.review.decision ?? null,
    })),
    unreadableFiles: problems.map((problem) => `${problem.file}: ${problem.message}`),
  };
}

export async function getRunTool(dir: string, input: Input<'get_run'>) {
  const record = await load(dir, input.run_id);
  const { finished } = record;
  const [verdict, decision] = await Promise.all([
    readVerdict(dir, input.run_id).catch(() => undefined),
    readDecision(dir, input.run_id).catch(() => undefined),
  ]);
  return {
    summary: summarizeRun(record),
    task: record.started.task,
    ...(finished?.result
      ? clip('finalResult', finished.result, resultLimit)
      : { finalResult: null }),
    error: finished?.error ?? null,
    filesChanged: finished?.changes?.files ?? null,
    commandsRun: commandsRun(record, 300).map((command) => ({
      command: command.command,
      exitCode: command.exitCode,
      outputTail: command.output,
    })),
    review: { risk: verdict?.risk.tier ?? null, decision: decision?.decision ?? null },
  };
}

function describeEvent(event: RunEvent, index: number) {
  const base = { index, t: event.t, type: event.type };
  switch (event.type) {
    case 'run.started':
      return { ...base, ...clip('task', event.task), model: event.model };
    case 'status':
      return {
        ...base,
        status: event.status,
        ...(event.message ? clip('message', event.message) : {}),
      };
    case 'assistant':
      return { ...base, ...clip('text', event.text) };
    case 'thinking':
      return {
        ...base,
        ...(event.text ? clip('text', event.text) : {}),
        durationMs: event.durationMs ?? null,
      };
    case 'tool': {
      const result = event.result === undefined ? {} : clip('result', JSON.stringify(event.result));
      return {
        ...base,
        callId: event.callId,
        name: event.name,
        status: event.status,
        summary: describeToolCall(event.name, event.args),
        ...result,
      };
    }
    case 'usage':
      return { ...base, totalTokens: event.usage.totalTokens };
    case 'note':
      return { ...base, ...clip('text', event.text) };
    case 'gate':
      return { ...base, kind: event.kind, outcome: event.outcome, ...clip('detail', event.detail) };
    case 'run.finished':
      return {
        ...base,
        status: event.status,
        durationMs: event.durationMs,
        ...(event.result ? clip('result', event.result) : {}),
        ...(event.error ? clip('error', event.error) : {}),
      };
  }
}

export async function getRunEventsTool(dir: string, input: Input<'get_run_events'>) {
  const record = await load(dir, input.run_id);
  // The first event is run.started, which the record keeps apart from the rest.
  const all: RunEvent[] = [record.started, ...record.events];
  const page = all.slice(input.offset, input.offset + input.limit);
  const next = input.offset + page.length;
  return {
    total: all.length,
    offset: input.offset,
    limit: input.limit,
    nextOffset: next < all.length ? next : null,
    events: page.map((event, position) => describeEvent(event, input.offset + position)),
  };
}

export async function getVerdictTool(dir: string, input: Input<'get_verdict'>) {
  await load(dir, input.run_id);
  const [verdict, decision] = await Promise.all([
    readVerdict(dir, input.run_id).catch((error: unknown) => {
      throw new ToolError(
        `The verdict file for ${input.run_id} could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }),
    readDecision(dir, input.run_id).catch(() => undefined),
  ]);
  return {
    verdict: verdict ?? null,
    decision: decision ?? null,
    ...(verdict
      ? {}
      : {
          note: `No review has been written for ${input.run_id}. A person runs: avero verdict ${input.run_id}`,
        }),
  };
}

export async function getChangesTool(dir: string, input: Input<'get_changes'>) {
  const record = await load(dir, input.run_id);
  const changes = record.finished?.changes;
  if (!changes) {
    throw new ToolError(
      record.finished
        ? 'No changes were recorded for this run: the folder was not a git repository.'
        : 'This run did not finish, so no changes were recorded.',
    );
  }
  if (input.path === undefined) {
    return {
      files: changes.files,
      additions: changes.additions,
      deletions: changes.deletions,
      patchTruncated: changes.patchTruncated ?? false,
    };
  }
  const entry = changes.files.find((file) => file.path === input.path);
  if (!entry) {
    throw new ToolError(
      `${input.path} is not among the changed files: ${changes.files.map((file) => file.path).join(', ') || 'none'}.`,
    );
  }
  const diff = parseUnifiedDiff(changes.patch).find((file) => file.path === input.path);
  if (!diff) {
    return {
      path: entry.path,
      status: entry.status,
      patch: null,
      note:
        entry.status === 'untracked'
          ? 'A new file git did not track yet, so it has no patch. It was counted by its lines.'
          : changes.patchTruncated
            ? 'The recorded patch was cut before this file.'
            : 'No patch was recorded for this file.',
    };
  }
  const patch = cut(diff.text, patchLimit);
  return { path: entry.path, status: entry.status, patch: patch.text, patchCut: patch.cut };
}

function snippet(text: string, at: number, length: number): string {
  const start = Math.max(0, at - 60);
  const piece = text
    .slice(start, at + length + 100)
    .replace(/\s+/g, ' ')
    .trim();
  return `${start > 0 ? '…' : ''}${piece}${at + length + 100 < text.length ? '…' : ''}`;
}

export async function searchRunsTool(dir: string, input: Input<'search_runs'>) {
  const needle = input.query.toLowerCase();
  const { runs } = await listRuns(dir);
  const matches: {
    runId: string;
    startedAt: string;
    status: string;
    matchedIn: string[];
    snippet: string;
  }[] = [];
  let scanned = 0;
  for (const run of runs) {
    if (matches.length >= input.limit) break;
    let record: RunRecord;
    try {
      record = await readRun(dir, run.runId);
    } catch {
      continue;
    }
    scanned += 1;
    const places: [string, string][] = [
      ['task', record.started.task],
      ['result', record.finished?.result ?? ''],
    ];
    const found = places.filter(([, text]) => text.toLowerCase().includes(needle));
    const first = found[0];
    if (!first) continue;
    matches.push({
      runId: run.runId,
      startedAt: run.startedAt,
      status: run.status,
      matchedIn: found.map(([place]) => place),
      snippet: snippet(first[1], first[1].toLowerCase().indexOf(needle), needle.length),
    });
  }
  return { query: input.query, matches, runsSearched: scanned, totalRuns: runs.length };
}
