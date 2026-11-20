import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  benchResultSchema,
  type BenchCell,
  type BenchConfig,
  type BenchResult,
  type BenchSuite,
  type BenchTask,
} from '@avero/contracts';
import { recordRun, type CreateAgent, type RunLimits } from '@avero/coding-engine';
import { createRunWriter, readRun } from '@avero/run-store';
import { git, shell } from './git.ts';
import { commitAll, withWorktree } from './worktree.ts';

export type RunBenchOptions = {
  /** The repository the suite was built from. Its own checkout is never touched. */
  repoDir: string;
  suite: BenchSuite;
  configs: BenchConfig[];
  /** Where each attempt's run record is written, so it can be replayed and reviewed. */
  runsDir: string;
  repeats?: number;
  /** Caps for every attempt. Strongly advised: a bench spends real money. */
  limits?: RunLimits;
  /** Only these tasks. */
  taskIds?: string[];
  sandbox?: boolean;
  apiKey?: string;
  createAgent?: CreateAgent;
  signal?: AbortSignal;
  testTimeoutMs?: number;
  benchId?: string;
  now?: () => Date;
  onProgress?: (event: {
    index: number;
    total: number;
    task: BenchTask;
    config: BenchConfig;
    repeat: number;
    cell?: BenchCell;
  }) => void;
};

function runIdFor(benchId: string, config: BenchConfig, task: BenchTask, repeat: number): string {
  return `${benchId}-${config.id.slice(0, 24)}-${task.id.slice(0, 48)}-${repeat}`;
}

/** Writes the configuration's rules files into a checkout and commits them, so the run's own
 * changes are the only ones that show up afterwards. */
async function applyRules(dir: string, config: BenchConfig): Promise<void> {
  if (config.rules.length === 0) return;
  for (const file of config.rules) {
    const target = join(dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
  await commitAll(dir, 'bench: rules');
}

async function attempt(
  options: RunBenchOptions,
  benchId: string,
  task: BenchTask,
  config: BenchConfig,
  repeat: number,
): Promise<BenchCell> {
  const base = { taskId: task.id, configId: config.id, repeat };
  const failed = (note: string, extra: Partial<BenchCell> = {}): BenchCell => ({
    ...base,
    outcome: 'error',
    testsExitCode: null,
    testsOutput: '',
    costCents: null,
    durationMs: 0,
    note,
    ...extra,
  });

  try {
    return await withWorktree(options.repoDir, task.baseSha, async (dir) => {
      if (options.suite.setupCommand) {
        const setup = await shell(
          dir,
          options.suite.setupCommand,
          options.testTimeoutMs ?? 300_000,
        );
        if (setup.exitCode !== 0)
          return failed(`The setup command failed (${setup.exitCode ?? 'no exit code'}).`, {
            testsOutput: setup.output,
          });
      }
      await applyRules(dir, config);

      const runId = runIdFor(benchId, config, task, repeat);
      const writer = await createRunWriter(options.runsDir, runId);
      const recorded = await recordRun({
        task: task.prompt,
        cwd: dir,
        model: config.model,
        runId,
        sandbox: options.sandbox ?? true,
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        ...(options.limits ? { limits: options.limits } : {}),
        ...(options.createAgent ? { createAgent: options.createAgent } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
        sink: writer.write,
      });
      const record = await readRun(options.runsDir, runId);
      const finished = record.finished;
      const spent = {
        runId,
        runStatus: recorded.status,
        ...(finished?.usage ? { usage: finished.usage } : {}),
        costCents: finished?.cost?.chargedCents ?? null,
        durationMs: finished?.durationMs ?? 0,
      };

      // The agent could not run at all (for example the account refused): nothing to judge.
      if (recorded.status === 'ERROR' && (finished?.changes?.files.length ?? 0) === 0) {
        return {
          ...base,
          ...spent,
          outcome: 'error' as const,
          testsExitCode: null,
          testsOutput: '',
          note: finished?.error?.slice(0, 500) ?? 'The agent run failed.',
        };
      }

      // Put the original tests back over anything the agent touched, then let them decide.
      await git(dir, ['checkout', task.solutionSha, '--', ...task.testFiles]);
      const tests = await shell(dir, options.suite.testCommand, options.testTimeoutMs ?? 300_000);
      const cut = recorded.status === 'CANCELLED' ? 'Stopped by a cap or cancelled. ' : '';
      if (tests.exitCode === null) {
        return {
          ...base,
          ...spent,
          outcome: 'error' as const,
          testsExitCode: null,
          testsOutput: tests.output,
          note: `${cut}${tests.timedOut ? 'The tests timed out.' : 'The tests could not run.'}`,
        };
      }
      return {
        ...base,
        ...spent,
        outcome: tests.exitCode === 0 ? ('resolved' as const) : ('unresolved' as const),
        testsExitCode: tests.exitCode,
        testsOutput: tests.output,
        ...(cut ? { note: cut.trim() } : {}),
      };
    });
  } catch (error) {
    return failed(error instanceof Error ? error.message.slice(0, 500) : 'The attempt failed.');
  }
}

/**
 * Runs every task under every configuration, each attempt in a fresh checkout of the commit the
 * task starts from, and scores it by the original tests. Each attempt is recorded as a run.
 */
export async function runBench(options: RunBenchOptions): Promise<BenchResult> {
  const now = options.now ?? (() => new Date());
  const benchId = options.benchId ?? `bench-${now().getTime().toString(36)}`;
  const repeats = options.repeats ?? 1;
  const tasks = options.suite.tasks.filter(
    (task) => !options.taskIds || options.taskIds.includes(task.id),
  );
  const total = tasks.length * options.configs.length * repeats;
  const cells: BenchCell[] = [];
  const startedAt = now().toISOString();

  let index = 0;
  outer: for (const task of tasks) {
    for (const config of options.configs) {
      for (let repeat = 0; repeat < repeats; repeat++) {
        if (options.signal?.aborted) break outer;
        index += 1;
        options.onProgress?.({ index, total, task, config, repeat });
        const cell = await attempt(options, benchId, task, config, repeat);
        cells.push(cell);
        options.onProgress?.({ index, total, task, config, repeat, cell });
      }
    }
  }

  return benchResultSchema.parse({
    v: 1,
    id: benchId,
    suiteId: options.suite.id,
    startedAt,
    finishedAt: now().toISOString(),
    repeats,
    ...(options.limits ? { limits: options.limits } : {}),
    configs: options.configs,
    cells,
  });
}
