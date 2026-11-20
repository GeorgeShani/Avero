import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SDKCustomTool } from '@cursor/sdk';
import { z } from 'zod';
import {
  configMetrics,
  hillclimbSchema,
  type BenchResult,
  type BenchSuite,
  type Hillclimb,
  type HillclimbIteration,
} from '@avero/contracts';
import { createCursorAgent, type CreateAgent, type RunLimits } from '@avero/coding-engine';
import { readRun } from '@avero/run-store';
import { runBench } from './runner.ts';

export const maxRulesChars = 6000;

export type Failure = {
  taskTitle: string;
  prompt: string;
  /** The end of the test output, which is what a developer would see. */
  testsOutput: string;
  /** What the agent said when it finished. */
  agentSaid: string;
};

export type ProposerInput = {
  currentRules: string;
  rulesPath: string;
  failures: Failure[];
  attempts: number;
  resolved: number;
};

export type Proposal = { rationale: string; rules: string };
export type Proposer = (input: ProposerInput) => Promise<Proposal>;

const proposalSchema = z.strictObject({
  rationale: z.string().min(1).max(600),
  rules: z.string().max(maxRulesChars),
});

export const proposerInstructions = `You improve the rules file that a coding agent reads before it works on a repository (an AGENTS.md or similar). The agent was given tasks from the repository's history. You are shown the tasks it failed, the end of the test output, and what it said when it stopped.

Propose ONE focused change to the rules: add, remove or reword a few lines that would help an agent on tasks like these. Return the complete new rules text.

Rules for your proposal:
- Write general guidance a maintainer would put in AGENTS.md: how to approach changes, what to check, habits that avoid the failures you see. Do not describe the specific tasks.
- Do not mention file names, test names, function names, expected values or error messages from the tasks shown. The same rules will be tried on other tasks; anything specific to these would be cheating.
- Keep the whole file short (under ${maxRulesChars} characters). Prefer fewer, clearer lines. Do not tell the agent to edit or skip the tests.
- Call propose_rules exactly once with a one-sentence rationale and the full rules text, then reply "done".`;

function issuesText(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'proposal'}: ${issue.message}`)
    .join('; ');
}

/** A proposer that asks a Cursor agent, answering through a structured tool so its output is checked. */
export function cursorProposer(options: {
  model: string;
  apiKey?: string;
  createAgent?: CreateAgent;
}): Proposer {
  return async (input) => {
    const create = options.createAgent ?? createCursorAgent;
    let proposal: Proposal | undefined;
    const tool: SDKCustomTool = {
      description: 'Submit the proposed change to the rules. Call it once.',
      inputSchema: z.toJSONSchema(proposalSchema) as SDKCustomTool['inputSchema'],
      execute: (args) => {
        const parsed = proposalSchema.safeParse(args);
        if (!parsed.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Not accepted: ${issuesText(parsed.error)}. Fix it and call propose_rules again.`,
              },
            ],
            isError: true,
          };
        }
        proposal = parsed.data;
        return 'Recorded. Reply "done".';
      },
    };

    const scratch = await mkdtemp(join(tmpdir(), 'avero-hill-'));
    try {
      await using agent = await create({
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        model: { id: options.model },
        tools: ['mcp'],
        local: {
          cwd: scratch,
          settingSources: [],
          sandboxOptions: { enabled: false },
          customTools: { propose_rules: tool },
        },
      });
      const prompt = [
        proposerInstructions,
        '---',
        `## Current rules (${input.rulesPath})\n${input.currentRules.trim() || '(none yet)'}`,
        `## Results\nThe agent resolved ${input.resolved} of ${input.attempts} attempts.`,
        ...input.failures.map(
          (failure, index) =>
            `## Failure ${index + 1}: ${failure.taskTitle}\nTask given to the agent:\n${failure.prompt}\n\nEnd of test output:\n${failure.testsOutput || '(none)'}\n\nThe agent said:\n${failure.agentSaid || '(nothing)'}`,
        ),
        'Propose the change now.',
      ].join('\n\n');
      for (let turn = 0; turn < 2 && !proposal; turn++) {
        const run = await agent.send(
          turn === 0 ? prompt : 'You did not call propose_rules. Call it now.',
        );
        for await (const message of run.stream()) void message;
        await run.wait();
      }
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
    if (!proposal) throw new Error('The proposer finished without proposing anything.');
    return proposal;
  };
}

/** Text in the rules that comes from the tasks themselves, which would leak the answer. */
export function leaksTask(rules: string, suite: BenchSuite): string | undefined {
  const text = rules.toLowerCase();
  for (const task of suite.tasks) {
    const needles = [
      task.id,
      task.solutionSha.slice(0, 7),
      ...task.testFiles.flatMap((path) => [path, path.split('/').at(-1) ?? path]),
    ];
    const hit = needles.find((needle) => needle.length >= 6 && text.includes(needle.toLowerCase()));
    if (hit) return hit;
  }
  return undefined;
}

type Score = { resolved: number; attempts: number; tokensPerResolved: number | null };

/** The configuration's score on some of the tasks (all of them when none are named). */
export function scoreOn(result: BenchResult, configId: string, taskIds?: string[]): Score {
  const subset: BenchResult = {
    ...result,
    cells: result.cells.filter((cell) => !taskIds || taskIds.includes(cell.taskId)),
  };
  const metrics = configMetrics(subset, configId);
  return {
    resolved: metrics.resolved,
    attempts: metrics.attempts,
    tokensPerResolved: metrics.tokensPerResolved,
  };
}

/** Keep a change only if it resolved more tasks, or the same number with clearly fewer tokens. */
export function decide(candidate: Score, best: Score): { keep: boolean; reason: string } {
  if (candidate.resolved > best.resolved) {
    return {
      keep: true,
      reason: `Resolved ${candidate.resolved} of ${candidate.attempts}, up from ${best.resolved}.`,
    };
  }
  if (candidate.resolved < best.resolved) {
    return {
      keep: false,
      reason: `Resolved ${candidate.resolved} of ${candidate.attempts}, down from ${best.resolved}.`,
    };
  }
  if (
    candidate.resolved > 0 &&
    candidate.tokensPerResolved !== null &&
    best.tokensPerResolved !== null &&
    candidate.tokensPerResolved < best.tokensPerResolved * 0.9
  ) {
    return {
      keep: true,
      reason: `Resolved the same ${candidate.resolved} with ${Math.round((1 - candidate.tokensPerResolved / best.tokensPerResolved) * 100)}% fewer tokens per resolved task.`,
    };
  }
  return {
    keep: false,
    reason: `No measurable gain: resolved ${candidate.resolved} of ${candidate.attempts}, same as before.`,
  };
}

export type HillclimbOptions = {
  repoDir: string;
  suite: BenchSuite;
  runsDir: string;
  model: string;
  /** Where the rules go in each checkout. */
  rulesPath?: string;
  /** The rules to start from. None by default. */
  startRules?: string;
  /** How many changes to try after the starting rules. */
  iterations?: number;
  repeats?: number;
  /** Tasks the proposer never sees. They alone decide whether a change is kept. */
  holdout?: number;
  limits?: RunLimits;
  sandbox?: boolean;
  apiKey?: string;
  createAgent?: CreateAgent;
  proposer?: Proposer;
  signal?: AbortSignal;
  testTimeoutMs?: number;
  id?: string;
  now?: () => Date;
  /** Called with each bench result as soon as it exists, so it can be saved. */
  onResult?: (result: BenchResult) => void | Promise<void>;
  /** Called with the hillclimb so far after every iteration. */
  onUpdate?: (hillclimb: Hillclimb) => void | Promise<void>;
  onProgress?: (message: string) => void;
};

async function failuresOf(
  options: HillclimbOptions,
  result: BenchResult,
  configId: string,
  trainIds: string[],
): Promise<Failure[]> {
  const failures: Failure[] = [];
  for (const cell of result.cells) {
    if (
      cell.configId !== configId ||
      cell.outcome === 'resolved' ||
      !trainIds.includes(cell.taskId)
    )
      continue;
    const task = options.suite.tasks.find((candidate) => candidate.id === cell.taskId);
    if (!task) continue;
    const said = cell.runId
      ? (await readRun(options.runsDir, cell.runId).catch(() => undefined))?.finished?.result
      : undefined;
    failures.push({
      taskTitle: task.title,
      prompt: task.prompt,
      testsOutput: cell.testsOutput.slice(-800),
      agentSaid: (said ?? cell.note ?? '').slice(0, 500),
    });
  }
  return failures.slice(0, 6);
}

/**
 * Improves a rules file by measurement. Runs the bench on the starting rules, asks for one change,
 * runs the bench again, and keeps the change only if it helped. Tasks stay frozen throughout.
 */
export async function hillclimb(
  options: HillclimbOptions,
): Promise<{ hillclimb: Hillclimb; results: BenchResult[] }> {
  const now = options.now ?? (() => new Date());
  const id = options.id ?? `hill-${now().getTime().toString(36)}`;
  const rulesPath = options.rulesPath ?? 'AGENTS.md';
  const iterations = options.iterations ?? 2;
  const say = options.onProgress ?? (() => undefined);
  const allIds = options.suite.tasks.map((task) => task.id);
  const holdoutCount = Math.min(options.holdout ?? 0, Math.max(0, allIds.length - 1));
  const holdoutIds = holdoutCount > 0 ? allIds.slice(-holdoutCount) : [];
  const trainIds = allIds.filter((taskId) => !holdoutIds.includes(taskId));
  const judgeIds = holdoutIds.length > 0 ? holdoutIds : undefined;
  const propose =
    options.proposer ??
    cursorProposer({
      model: options.model,
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...(options.createAgent ? { createAgent: options.createAgent } : {}),
    });

  const results: BenchResult[] = [];
  const history: HillclimbIteration[] = [];
  const startedAt = now().toISOString();

  const measure = async (
    n: number,
    rules: string,
  ): Promise<{ result: BenchResult; configId: string }> => {
    const configId = `i${n}`;
    const result = await runBench({
      repoDir: options.repoDir,
      suite: options.suite,
      configs: [
        {
          id: configId,
          label: n === 0 ? 'Starting rules' : `Change ${n}`,
          model: options.model,
          rules: rules.trim() ? [{ path: rulesPath, content: rules }] : [],
        },
      ],
      runsDir: options.runsDir,
      repeats: options.repeats ?? 1,
      ...(options.limits ? { limits: options.limits } : {}),
      ...(options.sandbox !== undefined ? { sandbox: options.sandbox } : {}),
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...(options.createAgent ? { createAgent: options.createAgent } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.testTimeoutMs ? { testTimeoutMs: options.testTimeoutMs } : {}),
      benchId: `${id}-i${n}`,
    });
    results.push(result);
    await options.onResult?.(result);
    return { result, configId };
  };

  const snapshot = (best: number): Hillclimb =>
    hillclimbSchema.parse({
      v: 1,
      id,
      suiteId: options.suite.id,
      model: options.model,
      rulesPath,
      startedAt,
      finishedAt: now().toISOString(),
      holdoutTaskIds: holdoutIds,
      iterations: history,
      bestIteration: best,
    });

  say('Measuring the starting rules…');
  let best = {
    n: 0,
    rules: options.startRules ?? '',
    ...(await measure(0, options.startRules ?? '')),
  };
  const startScore = scoreOn(best.result, best.configId, judgeIds);
  history.push({
    n: 0,
    rules: best.rules,
    rationale: '',
    resultId: best.result.id,
    ...startScore,
    kept: true,
    reason: 'The starting rules.',
  });
  await options.onUpdate?.(snapshot(0));

  for (let n = 1; n <= iterations; n++) {
    if (options.signal?.aborted) break;
    say(`Asking for change ${n}…`);
    const failures = await failuresOf(options, best.result, best.configId, trainIds);
    const bestScoreAll = scoreOn(best.result, best.configId);
    if (failures.length === 0) {
      say('Nothing failed on the tasks the proposer may see, so there is nothing to improve.');
      break;
    }

    let proposal: Proposal;
    try {
      proposal = await propose({
        currentRules: best.rules,
        rulesPath,
        failures,
        attempts: bestScoreAll.attempts,
        resolved: bestScoreAll.resolved,
      });
    } catch (error) {
      history.push({
        n,
        rules: best.rules,
        rationale: '',
        resolved: 0,
        attempts: 0,
        tokensPerResolved: null,
        kept: false,
        reason: `No proposal: ${error instanceof Error ? error.message.slice(0, 300) : 'failed'}`,
      });
      await options.onUpdate?.(snapshot(best.n));
      break;
    }

    const refusal =
      proposal.rules.trim() === best.rules.trim()
        ? 'The proposal is the same as the current rules.'
        : proposal.rules.length > maxRulesChars
          ? `The proposal is longer than ${maxRulesChars} characters.`
          : ((leak) =>
              leak
                ? `The proposal repeats text from the tasks (“${leak}”), which would leak the answer.`
                : undefined)(leaksTask(proposal.rules, options.suite));
    if (refusal) {
      history.push({
        n,
        rules: proposal.rules.slice(0, 20_000),
        rationale: proposal.rationale,
        resolved: 0,
        attempts: 0,
        tokensPerResolved: null,
        kept: false,
        reason: refusal,
      });
      await options.onUpdate?.(snapshot(best.n));
      continue;
    }

    say(`Measuring change ${n}…`);
    const measured = await measure(n, proposal.rules);
    const candidate = scoreOn(measured.result, measured.configId, judgeIds);
    const incumbent = scoreOn(best.result, best.configId, judgeIds);
    const verdict = decide(candidate, incumbent);
    history.push({
      n,
      rules: proposal.rules,
      rationale: proposal.rationale,
      resultId: measured.result.id,
      ...candidate,
      kept: verdict.keep,
      reason: verdict.reason,
    });
    if (verdict.keep) best = { n, rules: proposal.rules, ...measured };
    await options.onUpdate?.(snapshot(best.n));
  }

  return { hillclimb: snapshot(best.n), results };
}
