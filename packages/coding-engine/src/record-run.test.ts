import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentOptions, SDKCustomTool, SDKMessage } from '@cursor/sdk';
import { parseRunRecord, type RunEvent, type TokenUsage } from '@avero/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentLike, AgentRunLike, CreateAgent } from './agent-port.ts';
import { approvalGuidance, recordRun } from './recorder.ts';

const ids = { agent_id: 'a', run_id: 'r' };
const usage = (total: number): TokenUsage => ({
  inputTokens: total,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: total,
});
const say = (text: string): SDKMessage => ({
  type: 'assistant',
  ...ids,
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const usageMessage = (total: number): SDKMessage => ({
  type: 'usage',
  ...ids,
  usage: usage(total),
});

type Turn = {
  /** Each step is a message, or a function that runs at that point (it may wait). */
  steps: (SDKMessage | ((tools: Record<string, SDKCustomTool>) => Promise<void>))[];
  result?: string;
  tokens?: number;
  /** Wait this long before each step. */
  gapMs?: number;
};

function fake(turns: Turn[]) {
  const seen = {
    sends: [] as { prompt: string; mode?: string }[],
    options: undefined as AgentOptions | undefined,
    cancels: 0,
  };
  const createAgent: CreateAgent = async (options) => {
    seen.options = options;
    const agent: AgentLike = {
      send: async (prompt, sendOptions) => {
        seen.sends.push({ prompt, ...(sendOptions?.mode ? { mode: sendOptions.mode } : {}) });
        const turn = turns.shift() ?? { steps: [] };
        let cancelled = false;
        const run: AgentRunLike = {
          stream: async function* () {
            for (const step of turn.steps) {
              if (turn.gapMs) await new Promise((resolve) => setTimeout(resolve, turn.gapMs));
              if (cancelled) return;
              if (typeof step === 'function') await step(options.local?.customTools ?? {});
              else yield step;
            }
          },
          wait: async () => ({
            status: cancelled ? ('cancelled' as const) : ('finished' as const),
            ...(turn.result ? { result: turn.result } : {}),
            usage: usage(turn.tokens ?? 0),
          }),
          cancel: async () => {
            cancelled = true;
            seen.cancels++;
          },
        };
        return run;
      },
      getUsage: async () => {
        throw new Error('not available');
      },
      [Symbol.asyncDispose]: async () => undefined,
    };
    return agent;
  };
  return { createAgent, seen };
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-rec-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function record(
  options: Partial<Parameters<typeof recordRun>[0]> & { createAgent: CreateAgent },
) {
  const lines: string[] = [];
  const outcome = await recordRun({
    task: 'Add retries',
    cwd: dir,
    model: 'composer-2.5',
    apiKey: 'sk-test-secret-123',
    sink: (line) => void lines.push(line),
    ...options,
  });
  const parsed = parseRunRecord(lines.join('\n'));
  const gates = parsed.events.filter(
    (event): event is Extract<RunEvent, { type: 'gate' }> => event.type === 'gate',
  );
  return { outcome, lines, record: parsed, gates };
}

describe('recordRun', () => {
  it('records a plain run from start to finish', async () => {
    const { createAgent } = fake([
      { steps: [say('Hello '), say('there'), usageMessage(120)], result: 'done', tokens: 120 },
    ]);
    const { outcome, record: parsed } = await record({ createAgent });
    expect(outcome.status).toBe('FINISHED');
    expect(parsed.started.task).toBe('Add retries');
    expect(parsed.finished).toMatchObject({ status: 'FINISHED', result: 'done' });
    expect(parsed.finished?.usage?.totalTokens).toBe(120);
    const texts = parsed.events.filter((event) => event.type === 'assistant');
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatchObject({ text: 'Hello there' });
  });

  it('scrubs the API key from everything it writes', async () => {
    const { createAgent } = fake([
      { steps: [say('the key is sk-test-secret-123')], result: 'sk-test-secret-123' },
    ]);
    const { lines } = await record({ createAgent });
    expect(lines.join('\n')).not.toContain('sk-test-secret-123');
    expect(lines.join('\n')).toContain('[redacted]');
  });

  it('records a run whose agent could not be created as an error, with a finished line', async () => {
    const createAgent: CreateAgent = async () => {
      throw new Error('plan_required');
    };
    const { outcome, record: parsed } = await record({ createAgent });
    expect(outcome.status).toBe('ERROR');
    expect(parsed.finished?.error).toContain('plan_required');
  });
});

describe('limits', () => {
  it('stops the run when the token cap is reached, and records why', async () => {
    const { createAgent, seen } = fake([
      {
        steps: [usageMessage(500), usageMessage(3000), say('this must never be recorded')],
        tokens: 3000,
      },
    ]);
    const {
      outcome,
      record: parsed,
      gates,
    } = await record({ createAgent, limits: { maxTokens: 2000 } });
    expect(outcome.status).toBe('CANCELLED');
    expect(seen.cancels).toBe(1);
    expect(gates).toHaveLength(1);
    expect(gates[0]).toMatchObject({ kind: 'limit', outcome: 'tripped' });
    expect(gates[0]?.detail).toContain('Token cap reached');
    expect(parsed.finished?.error).toContain('Token cap reached');
    expect(JSON.stringify(parsed.events)).not.toContain('this must never be recorded');
  });

  it('stops the run when the time cap is reached', async () => {
    const { createAgent, seen } = fake([
      { steps: [say('a'), say('b'), say('c'), say('d')], gapMs: 150 },
    ]);
    const { outcome, gates } = await record({ createAgent, limits: { maxSeconds: 0.2 } });
    expect(outcome.status).toBe('CANCELLED');
    expect(seen.cancels).toBe(1);
    expect(gates[0]?.detail).toContain('Time cap reached');
  });

  it('does not stop a run that stays within its caps', async () => {
    const { createAgent, seen } = fake([{ steps: [usageMessage(100)], tokens: 100 }]);
    const { outcome, gates } = await record({
      createAgent,
      limits: { maxTokens: 1000, maxSeconds: 60 },
    });
    expect(outcome.status).toBe('FINISHED');
    expect(seen.cancels).toBe(0);
    expect(gates).toEqual([]);
  });
});

describe('plan gate', () => {
  it('plans first, asks, and carries the plan out when it is approved', async () => {
    const { createAgent, seen } = fake([
      { steps: [say('Thinking about it')], result: '1. Add a loop\n2. Add tests', tokens: 100 },
      { steps: [say('Implementing')], result: 'Implemented.', tokens: 400 },
    ]);
    const asked: string[] = [];
    const {
      outcome,
      record: parsed,
      gates,
    } = await record({
      createAgent,
      plan: { approve: (plan) => (asked.push(plan), true) },
    });
    expect(seen.sends.map((send) => send.mode)).toEqual(['plan', 'agent']);
    expect(asked).toEqual(['1. Add a loop\n2. Add tests']);
    expect(gates.map((gate) => [gate.kind, gate.outcome])).toEqual([
      ['plan', 'requested'],
      ['plan', 'approved'],
    ]);
    expect(gates[0]?.detail).toContain('Add a loop');
    expect(outcome.status).toBe('FINISHED');
    expect(parsed.finished?.result).toBe('Implemented.');
    expect(parsed.finished?.usage?.totalTokens).toBe(500);
  });

  it('shows the person the plan the agent wrote, not just its closing sentence', async () => {
    const createPlan: SDKMessage = {
      type: 'tool_call',
      ...ids,
      call_id: 'p1',
      name: 'createPlan',
      status: 'completed',
      args: { plan: '# Plan\n\n- Loop 4 times\n- Sleep 1s, 2s, 4s' },
    };
    const { createAgent } = fake([
      { steps: [createPlan], result: 'I made a plan.', tokens: 10 },
      { steps: [], result: 'Done.', tokens: 10 },
    ]);
    const asked: string[] = [];
    const { gates } = await record({
      createAgent,
      plan: { approve: (plan) => (asked.push(plan), true) },
    });
    expect(asked).toEqual(['# Plan\n\n- Loop 4 times\n- Sleep 1s, 2s, 4s']);
    expect(gates[0]?.detail).toContain('Sleep 1s, 2s, 4s');
  });

  it('changes nothing when the plan is not approved', async () => {
    const { createAgent, seen } = fake([{ steps: [], result: 'My plan', tokens: 50 }]);
    const {
      outcome,
      record: parsed,
      gates,
    } = await record({
      createAgent,
      plan: { approve: () => false },
    });
    expect(seen.sends).toHaveLength(1);
    expect(gates.map((gate) => gate.outcome)).toEqual(['requested', 'denied']);
    expect(outcome.status).toBe('CANCELLED');
    expect(parsed.finished?.error).toContain('not approved');
  });

  it('asks the plan question with the secret already scrubbed', async () => {
    const { createAgent } = fake([{ steps: [], result: 'Use key sk-test-secret-123', tokens: 1 }]);
    const { lines } = await record({ createAgent, plan: { approve: () => false } });
    expect(lines.join('\n')).not.toContain('sk-test-secret-123');
  });
});

describe('approvals', () => {
  it('gives the agent a request_approval tool, tells it to use it, and records every answer', async () => {
    let answer = '';
    const { createAgent, seen } = fake([
      {
        steps: [
          async (tools) => {
            const out = await tools.request_approval?.execute(
              { action: 'rm -rf build', reason: 'clean output' },
              {},
            );
            answer = String(out);
          },
        ],
        result: 'ok',
      },
    ]);
    const { gates } = await record({ createAgent, approvals: { approve: () => false } });
    expect(seen.sends[0]?.prompt).toContain(approvalGuidance);
    expect(Object.keys(seen.options?.local?.customTools ?? {})).toEqual(['request_approval']);
    expect(answer).toContain('Denied');
    expect(gates.map((gate) => [gate.kind, gate.outcome])).toEqual([
      ['approval', 'requested'],
      ['approval', 'denied'],
    ]);
    expect(gates[0]?.detail).toContain('rm -rf build');
  });

  it('does not count the time a person takes to answer against the time cap', async () => {
    const { createAgent, seen } = fake([
      {
        steps: [
          async (tools) => {
            await tools.request_approval?.execute({ action: 'npm install', reason: 'needed' }, {});
          },
        ],
        result: 'ok',
      },
    ]);
    const slow = () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 700));
    const { outcome } = await record({
      createAgent,
      limits: { maxSeconds: 0.3 },
      approvals: { approve: slow },
    });
    expect(seen.cancels).toBe(0);
    expect(outcome.status).toBe('FINISHED');
  });

  it('offers no approval tool and no extra instruction when approvals are off', async () => {
    const { createAgent, seen } = fake([{ steps: [], result: 'ok' }]);
    await record({ createAgent });
    expect(seen.options?.local?.customTools).toBeUndefined();
    expect(seen.sends[0]?.prompt).toBe('Add retries');
  });
});
