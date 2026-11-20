import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AgentLike, CreateAgent } from '@avero/coding-engine';
import type { BenchResult } from '@avero/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decide, hillclimb, leaksTask, scoreOn, type Proposer } from './hillclimb.ts';
import { buildSuite } from './suite.ts';
import { demoHistory, makeRepo } from './testing/make-repo.ts';

const solutions: Record<string, Record<string, string>> = {
  multiply: {
    'math.js': 'export const add = (a, b) => a + b;\nexport const multiply = (a, b) => a * b;\n',
  },
  clamp: {
    'clamp.js': 'export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);\n',
  },
};

/** An agent that solves every task, but only when its rules file says to be CAREFUL. */
const carefulAgent: CreateAgent = async (options) => {
  const cwd = options.local?.cwd ?? '';
  const agent: AgentLike = {
    send: async (prompt) => {
      const rules = await readFile(join(cwd, 'AGENTS.md'), 'utf8').catch(() => '');
      if (rules.includes('CAREFUL')) {
        const key = prompt.includes('multiply') ? 'multiply' : 'clamp';
        for (const [path, content] of Object.entries(solutions[key] ?? {})) {
          await mkdir(dirname(join(cwd, path)), { recursive: true });
          await writeFile(join(cwd, path), content);
        }
      }
      return {
        stream: async function* () {
          // nothing streams
        },
        wait: async () => ({
          status: 'finished' as const,
          result: rules.includes('CAREFUL') ? 'Done.' : 'I could not work out what to change.',
          usage: {
            inputTokens: 900,
            outputTokens: 100,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 1000,
          },
        }),
        cancel: async () => undefined,
      };
    },
    getUsage: async () => {
      throw new Error('not available');
    },
    [Symbol.asyncDispose]: async () => undefined,
  };
  return agent;
};

let repoDir: string;
let runsDir: string;
beforeEach(async () => {
  repoDir = (await makeRepo(demoHistory)).dir;
  runsDir = await mkdtemp(join(tmpdir(), 'avero-hill-runs-'));
});
afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
  await rm(runsDir, { recursive: true, force: true });
});

const suiteOf = async () =>
  (await buildSuite({ repoDir, id: 'demo', testCommand: 'node --test', count: 5 })).suite;

/** A proposer that hands out the given rules in order. */
function proposals(...rules: string[]): {
  propose: Proposer;
  seen: { failures: number; currentRules: string }[];
} {
  const seen: { failures: number; currentRules: string }[] = [];
  const queue = [...rules];
  return {
    seen,
    propose: async (input) => {
      seen.push({ failures: input.failures.length, currentRules: input.currentRules });
      return { rationale: 'Try this.', rules: queue.shift() ?? 'unused' };
    },
  };
}

describe('decide', () => {
  const score = (resolved: number, tokensPerResolved: number | null, attempts = 4) => ({
    resolved,
    attempts,
    tokensPerResolved,
  });

  it('keeps a change that resolves more, and drops one that resolves fewer', () => {
    expect(decide(score(3, 5000), score(2, 1000)).keep).toBe(true);
    expect(decide(score(1, 100), score(2, 1000)).keep).toBe(false);
  });

  it('keeps the same number only when it is clearly cheaper', () => {
    expect(decide(score(2, 800), score(2, 1000)).keep).toBe(true);
    expect(decide(score(2, 950), score(2, 1000)).keep).toBe(false);
    expect(decide(score(0, null), score(0, null)).keep).toBe(false);
  });
});

describe('leaksTask', () => {
  it('finds a task id, a test file or a commit hash in the rules, and nothing in general advice', async () => {
    const suite = await suiteOf();
    const task = suite.tasks[0];
    if (!task) throw new Error('no task');
    expect(leaksTask('Be CAREFUL. Run tests often.', suite)).toBeUndefined();
    expect(leaksTask(`Remember ${task.testFiles[0]}`, suite)).toBe(task.testFiles[0]);
    expect(leaksTask(`See ${task.id}`, suite)).toBe(task.id);
  });
});

describe('scoreOn', () => {
  it('scores only the tasks asked about', () => {
    const cell = (taskId: string, outcome: 'resolved' | 'unresolved') => ({
      taskId,
      configId: 'c',
      repeat: 0,
      outcome,
      testsExitCode: outcome === 'resolved' ? 0 : 1,
      testsOutput: '',
      costCents: null,
      durationMs: 1,
    });
    const result: BenchResult = {
      v: 1,
      id: 'r',
      suiteId: 's',
      startedAt: '2026-11-21T10:00:00.000Z',
      repeats: 1,
      configs: [{ id: 'c', label: 'c', model: 'm', rules: [] }],
      cells: [cell('a', 'resolved'), cell('b', 'unresolved')],
    };
    expect(scoreOn(result, 'c')).toMatchObject({ resolved: 1, attempts: 2 });
    expect(scoreOn(result, 'c', ['b'])).toMatchObject({ resolved: 0, attempts: 1 });
  });
});

describe('hillclimb', () => {
  const base = () => ({
    repoDir,
    runsDir,
    model: 'solver',
    sandbox: false,
    createAgent: carefulAgent,
  });

  it('keeps a change that helps and drops one that does not, measuring each on the same frozen tasks', async () => {
    const suite = await suiteOf();
    const { propose, seen } = proposals('Write some code.', 'Be CAREFUL and check your work.');
    const { hillclimb: climb, results } = await hillclimb({
      ...base(),
      suite,
      proposer: propose,
      iterations: 2,
      id: 'h1',
    });
    expect(
      climb.iterations.map((iteration) => [iteration.n, iteration.resolved, iteration.kept]),
    ).toEqual([
      [0, 0, true],
      [1, 0, false],
      [2, 2, true],
    ]);
    expect(climb.bestIteration).toBe(2);
    expect(climb.iterations[2]?.rules).toContain('CAREFUL');
    expect(climb.iterations[2]?.reason).toContain('up from 0');
    expect(results).toHaveLength(3);
    // The proposer sees the failures, and after the dropped change it is still shown the starting rules.
    expect(seen[0]?.failures).toBe(2);
    expect(seen[1]?.currentRules).toBe('');
  });

  it('stops when everything already passes, because there is nothing to improve', async () => {
    const suite = await suiteOf();
    const { propose, seen } = proposals('unused');
    const { hillclimb: climb } = await hillclimb({
      ...base(),
      suite,
      proposer: propose,
      startRules: 'Be CAREFUL.',
      iterations: 3,
      id: 'h2',
    });
    expect(climb.iterations).toHaveLength(1);
    expect(seen).toHaveLength(0);
  });

  it('refuses a proposal that repeats text from the tasks, without running it', async () => {
    const suite = await suiteOf();
    const task = suite.tasks[0];
    if (!task) throw new Error('no task');
    const { propose } = proposals(`When asked for ${task.id}, be CAREFUL.`);
    const { hillclimb: climb, results } = await hillclimb({
      ...base(),
      suite,
      proposer: propose,
      iterations: 1,
      id: 'h3',
    });
    expect(climb.iterations[1]).toMatchObject({ kept: false });
    expect(climb.iterations[1]?.reason).toContain('leak the answer');
    expect(results).toHaveLength(1);
  });

  it('refuses a proposal identical to the current rules', async () => {
    const suite = await suiteOf();
    const { propose } = proposals('Write some code.');
    const { hillclimb: climb } = await hillclimb({
      ...base(),
      suite,
      proposer: propose,
      startRules: 'Write some code.',
      iterations: 1,
      id: 'h4',
    });
    expect(climb.iterations[1]?.reason).toContain('same as the current rules');
  });

  it('records a proposer that fails and stops, instead of throwing', async () => {
    const suite = await suiteOf();
    const failing: Proposer = async () => {
      throw new Error('the model was unavailable');
    };
    const { hillclimb: climb } = await hillclimb({
      ...base(),
      suite,
      proposer: failing,
      iterations: 2,
      id: 'h5',
    });
    expect(climb.iterations.at(-1)?.reason).toContain('the model was unavailable');
    expect(climb.bestIteration).toBe(0);
  });

  it('lets the proposer see only the tasks outside the hold-out, and judges on the hold-out alone', async () => {
    const suite = await suiteOf();
    const { propose, seen } = proposals('Be CAREFUL.');
    const { hillclimb: climb } = await hillclimb({
      ...base(),
      suite,
      proposer: propose,
      iterations: 1,
      holdout: 1,
      id: 'h6',
    });
    expect(climb.holdoutTaskIds).toHaveLength(1);
    expect(seen[0]?.failures).toBe(1);
    expect(climb.iterations[1]?.attempts).toBe(1);
  });

  it('reports every result and every step as it happens, so they can be saved', async () => {
    const suite = await suiteOf();
    const { propose } = proposals('Be CAREFUL.');
    const saved: string[] = [];
    const steps: number[] = [];
    await hillclimb({
      ...base(),
      suite,
      proposer: propose,
      iterations: 1,
      id: 'h7',
      onResult: (result) => void saved.push(result.id),
      onUpdate: (climb) => void steps.push(climb.iterations.length),
    });
    expect(saved).toEqual(['h7-i0', 'h7-i1']);
    expect(steps).toEqual([1, 2]);
  });
});
