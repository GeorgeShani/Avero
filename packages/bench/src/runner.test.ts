import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AgentLike, CreateAgent } from '@avero/coding-engine';
import { configMetrics, type BenchConfig } from '@avero/contracts';
import { readRun } from '@avero/run-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBench } from './runner.ts';
import { buildSuite } from './suite.ts';
import { demoHistory, makeRepo } from './testing/make-repo.ts';

/** What a capable agent would write for each task in the demo history. */
const solutions: Record<string, Record<string, string>> = {
  multiply: {
    'math.js': 'export const add = (a, b) => a + b;\nexport const multiply = (a, b) => a * b;\n',
  },
  clamp: {
    'clamp.js': 'export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);\n',
  },
};

/**
 * A fake Cursor agent. The model name picks its behaviour: "solver" writes the right files,
 * "lazy" writes nothing, "cheater" rewrites the tests to pass, "broken" fails to start.
 */
function fakeAgent(): { createAgent: CreateAgent; prompts: string[]; cwds: string[] } {
  const prompts: string[] = [];
  const cwds: string[] = [];
  const createAgent: CreateAgent = async (options) => {
    if (options.model?.id === 'broken') throw new Error('plan_required');
    const cwd = options.local?.cwd ?? '';
    cwds.push(cwd);
    const agent: AgentLike = {
      send: async (prompt) => {
        prompts.push(prompt);
        const model = options.model?.id;
        if (model === 'solver') {
          const key = prompt.includes('multiply') ? 'multiply' : 'clamp';
          for (const [path, content] of Object.entries(solutions[key] ?? {})) {
            await mkdir(dirname(join(cwd, path)), { recursive: true });
            await writeFile(join(cwd, path), content);
          }
        }
        if (model === 'cheater') {
          // Replaces any test file with one that always passes. The bench puts the originals back.
          for (const name of ['math.test.js', 'clamp.test.js']) {
            await writeFile(
              join(cwd, name),
              "import test from 'node:test';\ntest('passes', () => {});\n",
            );
          }
        }
        return {
          stream: async function* () {
            // nothing streams
          },
          wait: async () => ({
            status: 'finished' as const,
            result: 'Done.',
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
  return { createAgent, prompts, cwds };
}

const config = (id: string, model: string, rules: BenchConfig['rules'] = []): BenchConfig => ({
  id,
  label: id,
  model,
  rules,
});

let repoDir: string;
let runsDir: string;
beforeEach(async () => {
  repoDir = (await makeRepo(demoHistory)).dir;
  runsDir = await mkdtemp(join(tmpdir(), 'avero-bench-runs-'));
});
afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
  await rm(runsDir, { recursive: true, force: true });
});

async function suiteOf() {
  return (await buildSuite({ repoDir, id: 'demo', testCommand: 'node --test', count: 5 })).suite;
}

describe('runBench', () => {
  it('resolves what a capable agent solves, and leaves unsolved what a lazy one does not', async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const result = await runBench({
      repoDir,
      suite,
      configs: [config('good', 'solver'), config('lazy', 'lazy')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b1',
    });
    expect(result.cells).toHaveLength(4);
    expect(configMetrics(result, 'good')).toMatchObject({ resolved: 2, unresolved: 0 });
    expect(configMetrics(result, 'lazy')).toMatchObject({ resolved: 0, unresolved: 2 });
    expect(result.cells.find((cell) => cell.configId === 'lazy')?.testsExitCode).not.toBe(0);
  });

  it('records every attempt as a run that can be replayed, with its usage', async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const result = await runBench({
      repoDir,
      suite,
      configs: [config('good', 'solver')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b2',
    });
    for (const cell of result.cells) {
      expect(cell.runId).toBeTruthy();
      const record = await readRun(runsDir, cell.runId ?? '');
      expect(record.finished?.status).toBe('FINISHED');
      expect(cell.usage?.totalTokens).toBe(1000);
    }
  });

  it('gives the agent the task text, and never the tests that will judge it', async () => {
    const suite = await suiteOf();
    const { createAgent, prompts } = fakeAgent();
    await runBench({
      repoDir,
      suite,
      configs: [config('good', 'solver')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b3',
    });
    expect(prompts.some((prompt) => prompt.includes('Return value limited to the range'))).toBe(
      true,
    );
    expect(prompts.join('\n')).not.toContain('assert.equal(clamp(15, 0, 10), 10)');
  });

  it('puts the original tests back, so an agent that rewrites the tests cannot pass', async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const result = await runBench({
      repoDir,
      suite,
      configs: [config('cheat', 'cheater')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b4',
    });
    expect(configMetrics(result, 'cheat').resolved).toBe(0);
  });

  it("writes a configuration's rules into the checkout and keeps them out of the agent's changes", async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const rules = [{ path: 'AGENTS.md', content: 'Always run the tests.\n' }];
    const result = await runBench({
      repoDir,
      suite,
      configs: [config('ruled', 'solver', rules)],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b5',
      taskIds: [suite.tasks[0]?.id ?? ''],
    });
    const record = await readRun(runsDir, result.cells[0]?.runId ?? '');
    const paths = record.finished?.changes?.files.map((file) => file.path) ?? [];
    expect(paths).not.toContain('AGENTS.md');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('runs each attempt in its own checkout and removes it, leaving the repository alone', async () => {
    const suite = await suiteOf();
    const { createAgent, cwds } = fakeAgent();
    await runBench({
      repoDir,
      suite,
      configs: [config('good', 'solver')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b6',
    });
    expect(new Set(cwds).size).toBe(cwds.length);
    const readme = await readFile(join(repoDir, 'README.md'), 'utf8');
    expect(readme).toBe('# demo\n');
    const { git } = await import('./git.ts');
    expect((await git(repoDir, ['worktree', 'list'])).trim().split('\n')).toHaveLength(1);
    expect((await git(repoDir, ['status', '--porcelain'])).trim()).toBe('');
  });

  it('repeats each attempt as many times as asked', async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const result = await runBench({
      repoDir,
      suite,
      configs: [config('good', 'solver')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b7',
      repeats: 3,
      taskIds: [suite.tasks[0]?.id ?? ''],
    });
    expect(result.cells.map((cell) => cell.repeat)).toEqual([0, 1, 2]);
  });

  it('marks an attempt as an error, not a failure, when the agent could not start', async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const result = await runBench({
      repoDir,
      suite,
      configs: [config('bad', 'broken')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b8',
    });
    expect(result.cells.every((cell) => cell.outcome === 'error')).toBe(true);
    expect(result.cells[0]?.note).toContain('plan_required');
    expect(configMetrics(result, 'bad').errors).toBe(2);
  });

  it('stops when asked to, and keeps what it had', async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const abort = new AbortController();
    const result = await runBench({
      repoDir,
      suite,
      configs: [config('good', 'solver')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b9',
      signal: abort.signal,
      onProgress: (event) => {
        if (event.cell) abort.abort();
      },
    });
    expect(result.cells).toHaveLength(1);
  });

  it('reports progress before and after each attempt', async () => {
    const suite = await suiteOf();
    const { createAgent } = fakeAgent();
    const seen: string[] = [];
    await runBench({
      repoDir,
      suite,
      configs: [config('good', 'solver')],
      runsDir,
      createAgent,
      sandbox: false,
      benchId: 'b10',
      onProgress: (event) => seen.push(`${event.index}/${event.total}${event.cell ? ' done' : ''}`),
    });
    expect(seen).toEqual(['1/2', '1/2 done', '2/2', '2/2 done']);
  });
});
