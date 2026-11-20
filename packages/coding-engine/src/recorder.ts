import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { SDKCustomTool, SDKMessage } from '@cursor/sdk';
import {
  runRecordVersion,
  type RunEvent,
  type RunFinished,
  type RunStarted,
  type TokenUsage,
} from '@avero/contracts';
import { redactSecrets } from '@avero/security';
import { createCursorAgent, type AgentRunLike, type CreateAgent } from './agent-port.ts';
import { createCoalescer } from './coalesce.ts';
import { collectChanges, gitState } from './git-changes.ts';
import { limitReason, sumUsage, type RunLimits } from './limits.ts';
import { scrubWorkspacePath } from './scrub.ts';

const maxFieldChars = 8_000;
const maxGateChars = 8_000;

/** Added to the task when the agent may ask for approval. It is advice to the model: Avero cannot
 * make an agent call a tool, so it records every request and every answer instead. */
export const approvalGuidance =
  'Before you delete files, install packages, use the network, or run a command that changes anything outside this folder, call the request_approval tool with the action and the reason, and wait for the answer. If it is denied, do not do it: choose another way, or stop and say what you could not do.';

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
  /** Stop the run when it has used this many tokens or seconds. Time spent waiting for a person
   * does not count. */
  limits?: RunLimits;
  /** Plan first: the agent only plans, the plan goes to `approve`, and nothing is changed unless
   * it says yes. */
  plan?: { approve: (plan: string) => boolean | Promise<boolean> };
  /** Gives the agent a request_approval tool, and tells it to use it before risky actions. */
  approvals?: {
    approve: (request: { action: string; reason: string }) => boolean | Promise<boolean>;
  };
  /** The Cursor SDK by default. Tests pass a fake. */
  createAgent?: CreateAgent;
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

type TurnResult = Awaited<ReturnType<AgentRunLike['wait']>>;

/**
 * Runs one Cursor agent in a local folder and writes everything it does as a run record.
 * Secrets are scrubbed from every line before it reaches the sink.
 */
export async function recordRun(options: RecordRunOptions): Promise<RecordedRun> {
  const apiKey = options.apiKey ?? process.env.CURSOR_API_KEY;
  const secrets = [...(options.secrets ?? []), ...(apiKey ? [apiKey] : [])];
  const runId = options.runId ?? `run-${randomUUID().slice(0, 8)}`;
  const create = options.createAgent ?? createCursorAgent;
  const clock = performance.now();
  let seq = 0;
  let writing: Promise<void> = Promise.resolve();

  const emit = (event: Record<string, unknown>) => {
    const full = { ...event, seq: seq++, t: Math.round(performance.now() - clock) } as RunEvent;
    const line = scrubWorkspacePath(redactSecrets(JSON.stringify(full), secrets), options.cwd);
    writing = writing.then(() => options.sink(line));
    options.onEvent?.(JSON.parse(line) as RunEvent);
  };

  const pieces = createCoalescer(emit);

  // Time spent waiting for a person is not the agent's time, so it does not count against a cap.
  let pausedMs = 0;
  let pausedSince: number | undefined;
  /** Paused time so far, including a wait that has not ended yet. */
  const pausedNow = () =>
    pausedMs + (pausedSince === undefined ? 0 : performance.now() - pausedSince);
  const waitingForPerson = async <T>(question: () => T | Promise<T>): Promise<T> => {
    pausedSince = performance.now();
    try {
      return await question();
    } finally {
      pausedMs += performance.now() - pausedSince;
      pausedSince = undefined;
    }
  };

  const gate = (kind: 'plan' | 'approval' | 'limit', outcome: string, detail: string) => {
    pieces.flush();
    const cut = detail.length > maxGateChars;
    emit({
      type: 'gate',
      kind,
      outcome,
      detail: cut ? `${detail.slice(0, maxGateChars - 1)}…` : detail,
    });
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

  let stopped: string | undefined;
  let writtenPlan: string | undefined;
  let tokensBefore = 0;
  let tokensNow = 0;

  /** Streams one turn into the record, enforcing the caps while it goes. */
  async function drive(run: AgentRunLike): Promise<TurnResult> {
    const check = () => {
      if (stopped) return;
      const reason = limitReason(options.limits, {
        tokens: tokensBefore + tokensNow,
        elapsedMs: performance.now() - clock - pausedNow(),
      });
      if (!reason) return;
      stopped = reason;
      gate('limit', 'tripped', reason);
      void run.cancel().catch(() => undefined);
    };
    const onAbort = () => void run.cancel().catch(() => undefined);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = options.limits?.maxSeconds === undefined ? undefined : setInterval(check, 250);
    try {
      for await (const message of run.stream()) {
        // In plan mode the agent writes its plan through a createPlan tool call; its final message
        // is only a sentence about it. Keep the plan itself so a person approves what it says.
        if (message.type === 'tool_call' && message.name === 'createPlan') {
          const written = (message.args as { plan?: unknown } | undefined)?.plan;
          if (typeof written === 'string' && written.trim()) writtenPlan = written;
        }
        for (const event of eventsFor(message)) {
          pieces.push(event);
          if (event.type === 'usage') {
            tokensNow = (event.usage as TokenUsage).totalTokens;
            check();
          }
        }
      }
      pieces.flush();
      const turn = await run.wait();
      tokensBefore += turn.usage?.totalTokens ?? tokensNow;
      tokensNow = 0;
      return turn;
    } finally {
      if (timer) clearInterval(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  const approvalTool: SDKCustomTool | undefined = options.approvals && {
    description:
      'Ask a person for permission before doing something risky. Describe the action and why it is needed. The answer says whether you may go ahead.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'What you want to do, exactly.' },
        reason: { type: 'string', description: 'Why it is needed for the task.' },
      },
      required: ['action', 'reason'],
    },
    execute: async (args) => {
      const action = String(args.action ?? '').slice(0, 500);
      const reason = String(args.reason ?? '').slice(0, 1000);
      gate('approval', 'requested', `${action}\nWhy: ${reason}`);
      const ok = await waitingForPerson(() => options.approvals?.approve({ action, reason }));
      gate('approval', ok ? 'approved' : 'denied', action);
      return ok
        ? 'Approved by the person. Go ahead.'
        : 'Denied by the person. Do not do this. Choose another way, or stop and say what you could not do.';
    },
  };

  try {
    await using agent = await create({
      ...(apiKey ? { apiKey } : {}),
      model: { id: options.model },
      local: {
        cwd: options.cwd,
        sandboxOptions: { enabled: options.sandbox ?? true },
        ...(approvalTool ? { customTools: { request_approval: approvalTool } } : {}),
      },
    });
    const prompt = options.approvals ? `${options.task}\n\n${approvalGuidance}` : options.task;
    const turns: TurnResult[] = [];
    let denied: string | undefined;

    if (options.plan) {
      const planning = await drive(await agent.send(prompt, { mode: 'plan' }));
      turns.push(planning);
      if (!stopped && planning.status === 'finished') {
        const plan =
          writtenPlan?.trim() || planning.result?.trim() || '(The agent returned no plan text.)';
        gate('plan', 'requested', plan);
        const approved = await waitingForPerson(() => options.plan?.approve(plan));
        gate('plan', approved ? 'approved' : 'denied', '');
        if (approved) {
          turns.push(
            await drive(
              await agent.send('The plan is approved. Carry it out now.', { mode: 'agent' }),
            ),
          );
        } else {
          denied = 'The plan was not approved, so nothing was changed.';
        }
      }
    } else {
      turns.push(await drive(await agent.send(prompt)));
    }

    const last = turns.at(-1);
    status = stopped || denied ? 'CANCELLED' : last ? statusOf(last.status) : 'ERROR';
    result = last?.result;
    error = stopped ?? denied ?? last?.error?.message.slice(0, 4000);
    usage = sumUsage(turns.map((turn) => turn.usage));

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

  pieces.flush();
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
