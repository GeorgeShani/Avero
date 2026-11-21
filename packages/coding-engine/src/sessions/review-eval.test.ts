import type { SDKCustomTool } from '@cursor/sdk';
import type { VerdictSubmission } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import type { AgentLike, CreateAgent } from '../adapters/agent-port.ts';
import { judge, reviewCases, runReviewEval } from './review-eval.ts';

const byId = (id: string) => {
  const found = reviewCases.find((testCase) => testCase.id === id);
  if (!found) throw new Error(`no case ${id}`);
  return found;
};

/** A reviewer that returns whatever it is told to for each case, in order. */
function scripted(submissions: VerdictSubmission[]): CreateAgent {
  return async (options) => {
    const agent: AgentLike = {
      send: async () => {
        const next = submissions.shift();
        const tools = (options.local?.customTools ?? {}) as Record<string, SDKCustomTool>;
        if (next) await tools.submit_verdict?.execute(next as never, {});
        return {
          stream: async function* () {
            // nothing streams
          },
          wait: async () => ({ status: 'finished' as const }),
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
      [Symbol.asyncDispose]: async () => undefined,
    };
    return agent;
  };
}

const pass = (id: string) => ({ id, claim: id, verdict: 'pass' as const, evidence: 'shown' });
const fail = (id: string) => ({ id, claim: id, verdict: 'fail' as const, evidence: 'not shown' });
const base: VerdictSubmission = {
  summary: 'Reviewed.',
  checks: [pass('c1')],
  outOfScope: [],
  tests: { ran: true, passed: true, evidence: 'npm test exit 0' },
  risk: { tier: 'low', reasons: [] },
};

describe('review cases', () => {
  it('are well formed: each parses, has a distinct id, and states what to look for', () => {
    expect(new Set(reviewCases.map((c) => c.id)).size).toBe(reviewCases.length);
    for (const testCase of reviewCases) {
      expect(testCase.record.finished?.changes?.patch).toBeTruthy();
      expect(testCase.expect.length).toBeGreaterThan(0);
      expect(testCase.describes.length).toBeGreaterThan(20);
    }
  });

  it('puts a shell command in every case but the one about an unverified claim', () => {
    const withCommands = reviewCases
      .filter((testCase) => testCase.record.events.some((event) => event.type === 'tool'))
      .map((testCase) => testCase.id);
    expect(withCommands).toEqual(['good-retry', 'fixed-delay', 'scope-creep']);
  });
});

describe('judge', () => {
  const good = {
    ...base,
    v: 1 as const,
    runId: 'r',
    reviewer: { model: 'm', reviewedAt: '2026-11-20T10:00:00.000Z' },
    adjustments: [],
  };

  it('accepts a right answer and names each point a wrong answer gets wrong', () => {
    expect(judge(byId('good-retry'), good)).toEqual([]);
    expect(judge(byId('good-retry'), { ...good, checks: [fail('c1')] })).toHaveLength(1);
    expect(judge(byId('fixed-delay'), good)).toHaveLength(2);
    expect(
      judge(byId('fixed-delay'), {
        ...good,
        checks: [fail('c1')],
        risk: { tier: 'medium', reasons: [] },
      }),
    ).toEqual([]);
    expect(judge(byId('scope-creep'), good)).toHaveLength(2);
    expect(judge(byId('unverified-claim'), good)).toHaveLength(2);
  });
});

describe('runReviewEval', () => {
  it('scores a reviewer that gets every case right, and one that misses the bad ones', async () => {
    const right: VerdictSubmission[] = [
      base,
      {
        ...base,
        checks: [pass('c1'), fail('c2')],
        risk: { tier: 'medium', reasons: ['A check failed.'] },
      },
      {
        ...base,
        outOfScope: [{ path: 'package.json', reason: 'not asked' }],
        risk: { tier: 'medium', reasons: ['x'] },
      },
      {
        ...base,
        checks: [{ id: 'c1', claim: 'Tests pass', verdict: 'unclear', evidence: 'no command ran' }],
        tests: { ran: false, evidence: 'none' },
      },
    ];
    const good = await runReviewEval({ model: 'm', createAgent: scripted([...right]) });
    expect(good.map((result) => result.problems)).toEqual([[], [], [], []]);

    const lazy = await runReviewEval({
      model: 'm',
      createAgent: scripted([base, base, base, base]),
    });
    expect(lazy.find((result) => result.id === 'good-retry')?.problems).toEqual([]);
    expect(lazy.find((result) => result.id === 'fixed-delay')?.problems.length).toBeGreaterThan(0);
    expect(lazy.find((result) => result.id === 'scope-creep')?.problems.length).toBeGreaterThan(0);
    expect(
      lazy.find((result) => result.id === 'unverified-claim')?.problems.length,
    ).toBeGreaterThan(0);
  });

  it('reports a review that failed, instead of throwing, and keeps going', async () => {
    const results = await runReviewEval({ model: 'm', createAgent: scripted([]) });
    expect(results).toHaveLength(reviewCases.length);
    expect(results.every((result) => result.error?.includes('without submitting'))).toBe(true);
  });
});
