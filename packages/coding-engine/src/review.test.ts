import { existsSync } from 'node:fs';
import type { AgentOptions, SDKCustomTool } from '@cursor/sdk';
import { parseRunRecord, type RunEvent, type VerdictSubmission } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import type { AgentLike, CreateAgent } from './agent-port.ts';
import { buildDigest, ReviewError, reviewRun } from './review.ts';

const events: RunEvent[] = [
  {
    type: 'run.started',
    seq: 0,
    t: 0,
    v: 1,
    runId: 'run-abc',
    task: 'Retry failed deliveries with exponential backoff, at most 4 attempts.',
    model: 'composer-2.5',
    runtime: 'local',
    startedAt: '2026-11-20T10:00:00.000Z',
    workspace: 'demo',
  },
  {
    type: 'tool',
    seq: 1,
    t: 5,
    callId: 's',
    name: 'shell',
    status: 'running',
    args: { command: 'npm test' },
  },
  {
    type: 'tool',
    seq: 2,
    t: 9,
    callId: 's',
    name: 'shell',
    status: 'completed',
    result: { status: 'success', value: { exitCode: 0, stdout: 'pass 3\nfail 0', stderr: '' } },
  },
  {
    type: 'run.finished',
    seq: 3,
    t: 20,
    status: 'FINISHED',
    result: 'Added retries with a fixed 200 ms delay.',
    durationMs: 20,
    changes: {
      files: [{ path: 'deliver.js', status: 'modified', additions: 10, deletions: 1 }],
      additions: 10,
      deletions: 1,
      patch: 'diff --git a/deliver.js b/deliver.js\n@@ -1 +1,2 @@\n+const delay = 200;\n',
    },
  },
];
const record = parseRunRecord(events.map((event) => JSON.stringify(event)).join('\n'));

const good: VerdictSubmission = {
  summary: 'Retries, but the delay is fixed.',
  checks: [
    {
      id: 'c1',
      claim: 'Retries a failed delivery',
      verdict: 'pass',
      evidence: 'loop in deliver.js',
      files: ['deliver.js'],
    },
    {
      id: 'c2',
      claim: 'Backoff is exponential',
      verdict: 'fail',
      evidence: 'delay = 200 on every attempt',
      files: ['deliver.js'],
    },
  ],
  outOfScope: [],
  tests: { ran: true, passed: true, evidence: 'npm test exit 0' },
  risk: { tier: 'low', reasons: [] },
};

type Script = (tools: Record<string, SDKCustomTool>) => Promise<unknown> | unknown;

function fake(scripts: Script[]) {
  const seen: { options?: AgentOptions; prompts: string[]; disposed: boolean } = {
    prompts: [],
    disposed: false,
  };
  const createAgent: CreateAgent = async (options) => {
    seen.options = options;
    const agent: AgentLike = {
      send: async (prompt) => {
        seen.prompts.push(prompt);
        await scripts.shift()?.(options.local?.customTools ?? {});
        return {
          stream: async function* () {
            // no streamed messages are needed
          },
          wait: async () => ({
            status: 'finished' as const,
            usage: {
              inputTokens: 50,
              outputTokens: 10,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 60,
            },
          }),
          cancel: async () => undefined,
        };
      },
      getUsage: async () => ({
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 0,
        },
      }),
      [Symbol.asyncDispose]: async () => {
        seen.disposed = true;
      },
    };
    return agent;
  };
  return { createAgent, seen };
}

const submit =
  (value: unknown): Script =>
  (tools) =>
    tools.submit_verdict?.execute(value as never, {});

describe('buildDigest', () => {
  it('gives the task, the claim, the files, the diff and the commands', () => {
    const digest = buildDigest(record);
    expect(digest).toContain('Retry failed deliveries with exponential backoff');
    expect(digest).toContain('fixed 200 ms delay');
    expect(digest).toContain('modified deliver.js');
    expect(digest).toContain('+const delay = 200;');
    expect(digest).toContain('`npm test` → exit code 0');
  });

  it('says so when the diff was cut', () => {
    const cut = parseRunRecord(
      events
        .map((event) =>
          event.type === 'run.finished' && event.changes
            ? { ...event, changes: { ...event.changes, patchTruncated: true } }
            : event,
        )
        .map((event) => JSON.stringify(event))
        .join('\n'),
    );
    expect(buildDigest(cut)).toContain('(cut:');
  });

  it('says when nothing was run or changed', () => {
    const bare = parseRunRecord(JSON.stringify(events[0]));
    const digest = buildDigest(bare);
    expect(digest).toContain('No shell command was run.');
    expect(digest).toContain('without finishing');
  });
});

describe('reviewRun', () => {
  it('returns the submitted verdict with the reviewer and the usage', async () => {
    const { createAgent, seen } = fake([submit(good)]);
    const verdict = await reviewRun({
      record,
      model: 'composer-2.5',
      createAgent,
      now: () => new Date('2026-11-20T11:00:00Z'),
    });
    expect(verdict.runId).toBe('run-abc');
    expect(verdict.checks).toHaveLength(2);
    expect(verdict.reviewer).toMatchObject({
      model: 'composer-2.5',
      reviewedAt: '2026-11-20T11:00:00.000Z',
    });
    expect(verdict.reviewer.usage?.totalTokens).toBe(60);
    expect(seen.prompts[0]).toContain('## Task');
    expect(seen.prompts[0]).toContain('independent code reviewer');
    expect(seen.options?.systemPrompt).toBeUndefined();
  });

  it('raises risk when a check failed, and lists why', async () => {
    const { createAgent } = fake([submit(good)]);
    const verdict = await reviewRun({ record, model: 'm', createAgent });
    expect(verdict.risk.tier).toBe('medium');
    expect(verdict.adjustments.join(' ')).toContain('Risk raised from low to medium');
  });

  it('tells the reviewer what was wrong and accepts the corrected verdict', async () => {
    let first: unknown;
    const { createAgent } = fake([
      async (tools) => {
        first = await tools.submit_verdict?.execute({ summary: 'x' } as never, {});
        await tools.submit_verdict?.execute(good as never, {});
      },
    ]);
    const verdict = await reviewRun({ record, model: 'm', createAgent });
    expect(JSON.stringify(first)).toContain('not accepted');
    expect(JSON.stringify(first)).toContain('"isError":true');
    expect(verdict.checks).toHaveLength(2);
  });

  it('asks once more when the reviewer did not submit, then fails clearly', async () => {
    const { createAgent, seen } = fake([]);
    await expect(reviewRun({ record, model: 'm', createAgent })).rejects.toThrow(ReviewError);
    expect(seen.prompts).toHaveLength(2);
    expect(seen.prompts[1]).toContain('did not call submit_verdict');
  });

  it('accepts a verdict submitted on the follow-up', async () => {
    const { createAgent, seen } = fake([() => undefined, submit(good)]);
    const verdict = await reviewRun({ record, model: 'm', createAgent });
    expect(seen.prompts).toHaveLength(2);
    expect(verdict.checks[0]?.id).toBe('c1');
  });

  it('removes files the record shows were never changed', async () => {
    const [retry, backoff] = good.checks;
    if (!retry || !backoff) throw new Error('fixture needs two checks');
    const withGhost = {
      ...good,
      checks: [{ ...retry, files: ['deliver.js', 'ghost.js'] }, backoff],
    };
    const { createAgent } = fake([submit(withGhost)]);
    const verdict = await reviewRun({ record, model: 'm', createAgent });
    expect(verdict.checks[0]?.files).toEqual(['deliver.js']);
    expect(verdict.adjustments.join(' ')).toContain('ghost.js');
  });

  it('gives the reviewer no repository and no tools beyond the verdict tool, and cleans up', async () => {
    const { createAgent, seen } = fake([submit(good)]);
    await reviewRun({ record, model: 'm', createAgent });
    expect(seen.options?.tools).toEqual(['mcp']);
    const cwd = seen.options?.local?.cwd ?? '';
    expect(cwd).toContain('avero-review-');
    expect(existsSync(cwd)).toBe(false);
    expect(seen.disposed).toBe(true);
  });

  it('lets the reviewer read the repository, and nothing more, when given a folder', async () => {
    const { createAgent, seen } = fake([submit(good)]);
    await reviewRun({ record, model: 'm', createAgent, cwd: process.cwd() });
    expect(seen.options?.tools).toEqual(['read', 'grep', 'glob', 'mcp']);
    expect(seen.options?.local?.cwd).toBe(process.cwd());
  });
});
