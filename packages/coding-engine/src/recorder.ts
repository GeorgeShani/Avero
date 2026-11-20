import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Agent, type SDKMessage } from '@cursor/sdk';
import {
  runRecordVersion,
  type RunEvent,
  type RunFinished,
  type RunStarted,
  type TokenUsage,
} from '@avero/contracts';
import { redactSecrets } from '@avero/security';
import { createCoalescer } from './coalesce.ts';
import { collectChanges, gitState } from './git-changes.ts';
import { scrubWorkspacePath } from './scrub.ts';

const maxFieldChars = 8_000;

export type RecordRunOptions = {
  task: string;
  /** The folder the agent works in. It is edited in place. */
  cwd: string;
  model: string;
  /** Defaults to CURSOR_API_KEY. */
  apiKey?: string;
  /** Extra values to scrub from everything written. The API key is always scrubbed. */
  secrets?: readonly string[];
  /** Run the agent in the Cursor sandbox. On by default. */
  sandbox?: boolean;
  runId?: string;
  signal?: AbortSignal;
  /** Receives each record line, already scrubbed. Lines arrive in order. */
  sink: (line: string) => void | Promise<void>;
  /** Called with each event as it is recorded, for live progress. */
  onEvent?: (event: RunEvent) => void;
};

export type RecordedRun = {
  runId: string;
  status: RunFinished['status'];
};

/** Keeps a tool argument or result readable and bounded; flags when something was cut. */
function bound(value: unknown): { value: unknown; truncated: boolean } {
  if (value === undefined) return { value, truncated: false };
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined || text.length <= maxFieldChars) return { value, truncated: false };
  return { value: `${text.slice(0, maxFieldChars)}…`, truncated: true };
}

function statusOf(status: 'finished' | 'error' | 'cancelled'): RunFinished['status'] {
  return status === 'finished' ? 'FINISHED' : status === 'cancelled' ? 'CANCELLED' : 'ERROR';
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 4000);
  return 'The run failed.';
}

/**
 * Runs one Cursor agent in a local folder and writes everything it does as a run record.
 * Secrets are scrubbed from every line before it reaches the sink.
 */
export async function recordRun(options: RecordRunOptions): Promise<RecordedRun> {
  const apiKey = options.apiKey ?? process.env.CURSOR_API_KEY;
  const secrets = [...(options.secrets ?? []), ...(apiKey ? [apiKey] : [])];
  const runId = options.runId ?? `run-${randomUUID().slice(0, 8)}`;
  const clock = performance.now();
  let seq = 0;
  let writing: Promise<void> = Promise.resolve();

  const emit = (event: Record<string, unknown>) => {
    const full = { ...event, seq: seq++, t: Math.round(performance.now() - clock) } as RunEvent;
    const line = scrubWorkspacePath(redactSecrets(JSON.stringify(full), secrets), options.cwd);
    writing = writing.then(() => options.sink(line));
    options.onEvent?.(JSON.parse(line) as RunEvent);
  };

  const git = await gitState(options.cwd);
  const started: Omit<RunStarted, 'seq' | 't'> = {
    type: 'run.started',
    v: runRecordVersion,
    runId,
    task: options.task,
    model: options.model,
    runtime: 'local',
    startedAt: new Date().toISOString(),
    workspace: basename(options.cwd),
    ...(git ? { git } : {}),
  };
  emit(started);

  let status: RunFinished['status'] = 'ERROR';
  let result: string | undefined;
  let error: string | undefined;
  let usage: TokenUsage | undefined;
  let cost: RunFinished['cost'];

  try {
    await using agent = await Agent.create({
      ...(apiKey ? { apiKey } : {}),
      model: { id: options.model },
      local: {
        cwd: options.cwd,
        sandboxOptions: { enabled: options.sandbox ?? true },
      },
    });
    const run = await agent.send(options.task);
    options.signal?.addEventListener('abort', () => void run.cancel().catch(() => undefined), {
      once: true,
    });

    const pieces = createCoalescer(emit);
    for await (const message of run.stream()) {
      for (const event of eventsFor(message)) pieces.push(event);
    }
    pieces.flush();

    const finished = await run.wait();
    status = statusOf(finished.status);
    result = finished.result;
    if (finished.error) error = finished.error.message.slice(0, 4000);
    usage = finished.usage;

    // Billed cost needs the account to report it; a missing number is not an error.
    try {
      const billed = await agent.getUsage();
      cost = billed.cost
        ? { rawCents: billed.cost.rawCostCents, chargedCents: billed.cost.chargedCents }
        : undefined;
      usage ??= billed.usage;
    } catch (caught) {
      emit({
        type: 'note',
        text: `Billed cost was not available: ${errorText(caught)}`.slice(0, 4000),
      });
    }
  } catch (caught) {
    status = 'ERROR';
    error = errorText(caught);
  }

  const changes = await collectChanges(options.cwd).catch(() => undefined);
  emit({
    type: 'run.finished',
    status,
    ...(result ? { result } : {}),
    ...(error ? { error } : {}),
    durationMs: Math.round(performance.now() - clock),
    ...(usage ? { usage } : {}),
    ...(cost ? { cost } : {}),
    ...(changes ? { changes } : {}),
  });
  await writing;
  return { runId, status };
}

/** Turns one SDK message into zero or more record events. */
export function eventsFor(message: SDKMessage): Record<string, unknown>[] {
  switch (message.type) {
    case 'assistant': {
      const text = message.message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');
      return text ? [{ type: 'assistant', text }] : [];
    }
    case 'thinking': {
      const text = message.text;
      return [
        {
          type: 'thinking',
          ...(text ? { text } : {}),
          ...(message.thinking_duration_ms !== undefined
            ? { durationMs: message.thinking_duration_ms }
            : {}),
        },
      ];
    }
    case 'tool_call': {
      const args = bound(message.args);
      const result = bound(message.result);
      const truncated = {
        ...(args.truncated || message.truncated?.args ? { args: true } : {}),
        ...(result.truncated || message.truncated?.result ? { result: true } : {}),
      };
      return [
        {
          type: 'tool',
          callId: message.call_id,
          name: message.name,
          status: message.status,
          ...(args.value !== undefined ? { args: args.value } : {}),
          ...(result.value !== undefined ? { result: result.value } : {}),
          ...(Object.keys(truncated).length > 0 ? { truncated } : {}),
        },
      ];
    }
    case 'status':
      return [
        {
          type: 'status',
          status: message.status,
          ...(message.message ? { message: message.message.slice(0, 2000) } : {}),
        },
      ];
    case 'usage':
      return [{ type: 'usage', usage: message.usage }];
    case 'task':
      return message.text ? [{ type: 'note', text: message.text.slice(0, 4000) }] : [];
    default:
      return [];
  }
}
