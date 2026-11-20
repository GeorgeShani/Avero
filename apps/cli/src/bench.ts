import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { buildSuite, hillclimb, NoTasksError, runBench } from '@avero/bench';
import { slugify } from '@avero/bench';
import {
  cheapestConfig,
  type BenchConfig,
  type BenchSuite,
  type RulesFile,
} from '@avero/contracts';
import {
  benchRoot,
  listBenchResults,
  listSuites,
  readBenchResult,
  readHillclimb,
  listHillclimbs,
  readSuite,
  runsDir,
  writeBenchResult,
  writeHillclimb,
  writeSuite,
} from '@avero/run-store';
import { describeBench, parsePrices } from './bench-format.ts';

const usage = `avero bench: find out which setup works best on your repository, per dollar.

  avero bench init --repo <dir> --test "<command>" [--id <name>] [--setup "<command>"]
        [--count <n>] [--scan <n>] [--no-validate]
      Builds tasks from the repository's own history: commits that changed source and tests.
      The test command must exit 0 when the tests pass. It runs on this machine, in throwaway
      checkouts, and validation runs it at the base and solution commit of each candidate.

  avero bench run <suite> --repo <dir> --model <id>[,<id>...] [--rules <file>]...
        [--rules-path AGENTS.md] [--repeats <n>] [--task <id>]... [--max-tokens <n>]
        [--max-seconds <n>] [--no-sandbox]
      Runs every task under every setup. A setup is a model, with and without each rules file.
      This spends real Cursor usage: use the caps.

  avero bench show [<suite> [<result>]] [--prices <model>=<in>,<out>]...
  avero bench hillclimb <suite> --repo <dir> --model <id> [--iterations <n>] [--holdout <n>]
        [--rules-path AGENTS.md] [--start-rules <file>] [--max-tokens <n>] [--max-seconds <n>]
        [--no-sandbox]

Records are written to <repo>/.avero. Add --runs-dir <dir> to put them elsewhere.`;

const options = {
  repo: { type: 'string' },
  id: { type: 'string' },
  test: { type: 'string' },
  setup: { type: 'string' },
  count: { type: 'string' },
  scan: { type: 'string' },
  'no-validate': { type: 'boolean' },
  model: { type: 'string' },
  rules: { type: 'string', multiple: true },
  'rules-path': { type: 'string' },
  'start-rules': { type: 'string' },
  repeats: { type: 'string' },
  task: { type: 'string', multiple: true },
  'max-tokens': { type: 'string' },
  'max-seconds': { type: 'string' },
  'no-sandbox': { type: 'boolean' },
  prices: { type: 'string', multiple: true },
  iterations: { type: 'string' },
  holdout: { type: 'string' },
  'runs-dir': { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

function whole(name: string, raw: string | undefined, fallback: number): number | null {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (Number.isInteger(value) && value > 0) return value;
  console.error(`--${name} needs a whole number above zero.`);
  return null;
}

function positive(name: string, raw: string | undefined): number | undefined | null {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isFinite(value) && value > 0) return value;
  console.error(`--${name} needs a positive number.`);
  return null;
}

type Values = ReturnType<
  typeof parseArgs<{ options: typeof options; allowPositionals: true }>
>['values'];

const noKey = () => {
  console.error('CURSOR_API_KEY is not set. Put it in your environment or a .env file.');
  return 2;
};

function paths(values: Values) {
  const repoDir = resolve(values.repo ?? process.cwd());
  const runs = values['runs-dir'] ? resolve(values['runs-dir']) : runsDir(repoDir);
  return { repoDir, runs, root: benchRoot(runs) };
}

async function init(values: Values): Promise<number> {
  if (!values.test) {
    console.error('Say how to run the tests: avero bench init --repo <dir> --test "npm test"');
    return 2;
  }
  const count = whole('count', values.count, 5);
  const scan = whole('scan', values.scan, 200);
  if (count === null || scan === null) return 2;
  const { repoDir, root } = paths(values);
  const id = values.id ?? (slugify(basename(repoDir)) || 'suite');
  try {
    const { suite, skipped } = await buildSuite({
      repoDir,
      id,
      testCommand: values.test,
      ...(values.setup ? { setupCommand: values.setup } : {}),
      count,
      scan,
      validate: !values['no-validate'],
      onProgress: (message) => console.log(`  ${message}`),
    });
    const path = await writeSuite(root, suite);
    console.log(`\nSuite "${suite.id}": ${suite.tasks.length} task(s) from ${suite.repo.name}`);
    for (const task of suite.tasks) console.log(`  ${task.id}  ${task.title}`);
    for (const entry of skipped)
      console.log(`  skipped ${entry.sha.slice(0, 7)} ${entry.subject}: ${entry.reason}`);
    console.log(
      `Saved ${path}\nThe agent never sees the tests; they are put back after it finishes and decide.`,
    );
    if (suite.tasks.length < 5)
      console.log(
        'Fewer than 5 tasks gives a weak signal. Treat the first results as a smoke test.',
      );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not build the suite.');
    if (error instanceof NoTasksError)
      for (const entry of error.skipped.slice(0, 5))
        console.error(`  ${entry.sha.slice(0, 7)} ${entry.subject}: ${entry.reason}`);
    return 1;
  }
}

async function rulesFiles(
  paths: readonly string[],
  target: string,
): Promise<{ label: string; files: RulesFile[] }[]> {
  const variants: { label: string; files: RulesFile[] }[] = [];
  for (const path of paths) {
    variants.push({
      label: basename(path),
      files: [{ path: target, content: await readFile(resolve(path), 'utf8') }],
    });
  }
  return variants;
}

async function run(suiteId: string | undefined, values: Values): Promise<number> {
  if (!suiteId) {
    console.error('Which suite? avero bench run <suite> --repo <dir> --model <id>');
    return 2;
  }
  if (!process.env.CURSOR_API_KEY) return noKey();
  const models = (values.model ?? process.env.AVERO_CURSOR_MODEL ?? 'composer-2.5')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const repeats = whole('repeats', values.repeats, 1);
  const maxTokens = positive('max-tokens', values['max-tokens']);
  const maxSeconds = positive('max-seconds', values['max-seconds']);
  if (repeats === null || maxTokens === null || maxSeconds === null) return 2;
  const { repoDir, runs, root } = paths(values);
  const suite = await readSuite(root, suiteId);
  if (!suite) {
    console.error(`No suite "${suiteId}" in ${root}. Build one with: avero bench init`);
    return 1;
  }
  const unknown = (values.task ?? []).filter((id) => !suite.tasks.some((task) => task.id === id));
  if (unknown.length > 0) {
    console.error(
      `No such task: ${unknown.join(', ')}. Tasks: ${suite.tasks.map((task) => task.id).join(', ')}`,
    );
    return 1;
  }

  const variants = await rulesFiles(values.rules ?? [], values['rules-path'] ?? 'AGENTS.md');
  const configs: BenchConfig[] = models.flatMap((model) => [
    { id: slugify(model) || 'model', label: model, model, rules: [] },
    ...variants.map((variant) => ({
      id: `${slugify(model)}-${slugify(variant.label) || 'rules'}`.slice(0, 64),
      label: `${model} + ${variant.label}`,
      model,
      rules: variant.files,
    })),
  ]);

  const tasks = suite.tasks.filter(
    (task) => !values.task || values.task.length === 0 || values.task.includes(task.id),
  );
  const attempts = tasks.length * configs.length * repeats;
  console.log(
    `${attempts} attempt(s): ${tasks.length} task(s) × ${configs.length} setup(s) × ${repeats} repeat(s).`,
  );
  console.log(
    `Each is a real Cursor run${maxTokens || maxSeconds ? ` (capped at ${[maxTokens ? `${maxTokens} tokens` : '', maxSeconds ? `${maxSeconds} s` : ''].filter(Boolean).join(' and ')})` : ', with no cap. Consider --max-tokens and --max-seconds'}.\n`,
  );

  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  const result = await runBench({
    repoDir,
    suite,
    configs,
    runsDir: runs,
    repeats,
    ...(values.task && values.task.length > 0 ? { taskIds: values.task } : {}),
    ...(maxTokens !== undefined || maxSeconds !== undefined
      ? {
          limits: {
            ...(maxTokens !== undefined ? { maxTokens } : {}),
            ...(maxSeconds !== undefined ? { maxSeconds } : {}),
          },
        }
      : {}),
    sandbox: !values['no-sandbox'],
    signal: abort.signal,
    onProgress: (event) => {
      if (!event.cell) {
        console.log(
          `[${event.index}/${event.total}] ${event.task.title} · ${event.config.label}${repeats > 1 ? ` · repeat ${event.repeat + 1}` : ''}`,
        );
        return;
      }
      const mark =
        event.cell.outcome === 'resolved'
          ? '✓ resolved'
          : event.cell.outcome === 'error'
            ? '! could not be judged'
            : '✕ not resolved';
      console.log(`      ${mark}${event.cell.note ? ` (${event.cell.note})` : ''}`);
    },
  });
  const path = await writeBenchResult(root, result);
  const prices = parsePrices(values.prices ?? []);
  console.log(
    `\n${describeBench(result, suite, typeof prices === 'string' ? {} : prices).join('\n')}\n\nSaved ${path}`,
  );
  const cheapest = cheapestConfig(result, typeof prices === 'string' ? {} : prices);
  if (cheapest && result.configs.length > 1)
    console.log(
      `Lowest cost per resolved task: ${result.configs.find((config) => config.id === cheapest)?.label ?? cheapest}.`,
    );
  return result.cells.some((cell) => cell.outcome === 'error') ? 1 : 0;
}

async function show(
  suiteId: string | undefined,
  resultId: string | undefined,
  values: Values,
): Promise<number> {
  const { root } = paths(values);
  const prices = parsePrices(values.prices ?? []);
  if (typeof prices === 'string') {
    console.error(prices);
    return 2;
  }
  if (!suiteId) {
    const suites = await listSuites(root);
    if (suites.length === 0)
      console.log(`No bench suites in ${root}. Build one with: avero bench init`);
    for (const suite of suites)
      console.log(
        `${suite.id}  ${suite.tasks.length} task(s)  ${suite.repo.name}  ${suite.createdAt.slice(0, 10)}`,
      );
    return 0;
  }
  const suite = await readSuite(root, suiteId);
  if (!suite) {
    console.error(`No suite "${suiteId}".`);
    return 1;
  }
  if (!resultId) {
    const results = await listBenchResults(root, suiteId);
    console.log(
      `Suite ${suite.id}: ${suite.tasks.length} task(s)\n${suite.tasks.map((task) => `  ${task.id}  ${task.title}`).join('\n')}\n`,
    );
    if (results.length === 0) console.log('No results yet. Run: avero bench run');
    for (const result of results)
      console.log(
        `${result.id}  ${result.startedAt.slice(0, 16)}  ${result.configs.map((config) => config.label).join(' | ')}`,
      );
    for (const climb of await listHillclimbs(root, suiteId))
      console.log(`${climb.id}  hillclimb, best change ${climb.bestIteration}`);
    return 0;
  }
  const result = await readBenchResult(root, suiteId, resultId);
  if (!result) {
    const climb = await readHillclimb(root, suiteId, resultId);
    if (!climb) {
      console.error(`No result "${resultId}" for suite ${suiteId}.`);
      return 1;
    }
    for (const iteration of climb.iterations) {
      console.log(
        `${iteration.n === climb.bestIteration ? '★' : ' '} ${iteration.n === 0 ? 'start' : `change ${iteration.n}`}: ${iteration.kept ? 'kept' : 'dropped'} · ${iteration.reason}${iteration.rationale ? `\n    why: ${iteration.rationale}` : ''}`,
      );
    }
    console.log(
      `\nBest rules (${climb.rulesPath}):\n${climb.iterations[climb.bestIteration]?.rules || '(none)'}`,
    );
    return 0;
  }
  console.log(describeBench(result, suite, prices).join('\n'));
  return 0;
}

async function climb(suiteId: string | undefined, values: Values): Promise<number> {
  if (!suiteId) {
    console.error('Which suite? avero bench hillclimb <suite> --repo <dir> --model <id>');
    return 2;
  }
  if (!process.env.CURSOR_API_KEY) return noKey();
  const iterations = whole('iterations', values.iterations, 2);
  const holdout = values.holdout === undefined ? 0 : whole('holdout', values.holdout, 1);
  const maxTokens = positive('max-tokens', values['max-tokens']);
  const maxSeconds = positive('max-seconds', values['max-seconds']);
  if (iterations === null || holdout === null || maxTokens === null || maxSeconds === null)
    return 2;
  const { repoDir, runs, root } = paths(values);
  const suite: BenchSuite | undefined = await readSuite(root, suiteId);
  if (!suite) {
    console.error(`No suite "${suiteId}".`);
    return 1;
  }
  const model = (values.model ?? process.env.AVERO_CURSOR_MODEL ?? 'composer-2.5').trim();
  const startRules = values['start-rules']
    ? await readFile(resolve(values['start-rules']), 'utf8')
    : '';
  console.log(
    `Hillclimbing ${suite.id} with ${model}: the starting rules, then up to ${iterations} change(s), each measured on ${holdout ? `${suite.tasks.length - holdout} task(s) the proposer may see, and judged on ${holdout} it may not` : `all ${suite.tasks.length} tasks`}.\nThis spends real Cursor usage.\n`,
  );

  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  const { hillclimb: outcome } = await hillclimb({
    repoDir,
    suite,
    runsDir: runs,
    model,
    iterations,
    holdout,
    rulesPath: values['rules-path'] ?? 'AGENTS.md',
    startRules,
    ...(maxTokens !== undefined || maxSeconds !== undefined
      ? {
          limits: {
            ...(maxTokens !== undefined ? { maxTokens } : {}),
            ...(maxSeconds !== undefined ? { maxSeconds } : {}),
          },
        }
      : {}),
    sandbox: !values['no-sandbox'],
    signal: abort.signal,
    onProgress: (message) => console.log(message),
    onResult: async (result) => void (await writeBenchResult(root, result)),
    onUpdate: async (state) => {
      await writeHillclimb(root, state);
      const last = state.iterations.at(-1);
      if (last)
        console.log(
          `  ${last.n === 0 ? 'start' : `change ${last.n}`}: ${last.kept ? 'kept' : 'dropped'} · ${last.reason}`,
        );
    },
  });
  const best = outcome.iterations[outcome.bestIteration];
  console.log(
    `\nBest: ${outcome.bestIteration === 0 ? 'the starting rules' : `change ${outcome.bestIteration}`} (${best?.resolved ?? 0} of ${best?.attempts ?? 0} resolved).\nSaved as hillclimb ${outcome.id}. Show it with: avero bench show ${suite.id} ${outcome.id}`,
  );
  if (best && outcome.bestIteration > 0)
    console.log(`\nRules to keep (${outcome.rulesPath}):\n${best.rules}`);
  console.log(
    '\nA change that wins on a handful of tasks may be luck. Rerun with --repeats or more tasks before trusting it.',
  );
  return 0;
}

/** `avero bench ...` */
export async function benchCli(argv: string[]): Promise<number> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true });
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : 'Bad arguments.'}\n\n${usage}`);
    return 2;
  }
  const { positionals, values } = parsed;
  const [sub, first, second] = positionals;
  if (values.help || !sub) {
    console.log(usage);
    return sub || values.help ? 0 : 2;
  }
  switch (sub) {
    case 'init':
      return init(values);
    case 'run':
      return run(first, values);
    case 'show':
      return show(first, second, values);
    case 'hillclimb':
      return climb(first, values);
    default:
      console.error(`Unknown bench command "${sub}".\n\n${usage}`);
      return 2;
  }
}
