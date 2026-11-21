import { z } from 'zod';
import { runStatusSchema, tokenUsageSchema, type TokenUsage } from '../events/run-record.ts';

/**
 * Bench answers "which setup works best on my repository, per dollar?". A suite is a set of tasks
 * taken from the repository's own history. A configuration is a model plus a set of rules files.
 * A bench result is every task run under every configuration, scored by the tests.
 */
export const benchVersion = 1;

const sha = z.string().regex(/^[0-9a-f]{40}$/, 'a full 40-character commit hash');
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'lowercase letters, digits and dashes');

/** A path inside the repository: relative, no `..`, no drive letter. */
export const repoPathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.startsWith('\\') &&
      !/^[A-Za-z]:/.test(path) &&
      !path.split(/[\\/]/).includes('..'),
    'a relative path inside the repository',
  );

export const benchTaskSchema = z.strictObject({
  id: slug,
  title: z.string().min(1).max(200),
  /** What the agent is told. It never sees the solution or the tests that will judge it. */
  prompt: z.string().min(1).max(20_000),
  /** The commit the agent starts from. */
  baseSha: sha,
  /** The commit that solved it in history. Only its test files are used, to judge. */
  solutionSha: sha,
  /** Test files from the solution commit, put back after the agent finishes. */
  testFiles: z.array(repoPathSchema).min(1).max(50),
  source: z.strictObject({ kind: z.literal('commit'), subject: z.string().max(300) }),
});
export type BenchTask = z.infer<typeof benchTaskSchema>;

export const benchSuiteSchema = z.strictObject({
  v: z.literal(benchVersion),
  id: slug,
  createdAt: z.iso.datetime(),
  repo: z.strictObject({ name: z.string().max(200), head: sha }),
  /** Run in the repository root; exit code 0 means the tests pass. */
  testCommand: z.string().min(1).max(500),
  /** Run once in each fresh checkout before the agent starts, for example `npm ci`. */
  setupCommand: z.string().min(1).max(500).optional(),
  tasks: z.array(benchTaskSchema).min(1).max(100),
});
export type BenchSuite = z.infer<typeof benchSuiteSchema>;

export const rulesFileSchema = z.strictObject({
  path: repoPathSchema,
  content: z.string().max(20_000),
});
export type RulesFile = z.infer<typeof rulesFileSchema>;

export const benchConfigSchema = z.strictObject({
  id: slug,
  label: z.string().min(1).max(120),
  model: z.string().min(1).max(128),
  /** Files written into the checkout before the agent starts, such as AGENTS.md. */
  rules: z.array(rulesFileSchema).max(10),
});
export type BenchConfig = z.infer<typeof benchConfigSchema>;

export const benchOutcomes = ['resolved', 'unresolved', 'error'] as const;

export const benchCellSchema = z.strictObject({
  taskId: slug,
  configId: slug,
  /** Which repeat of this task under this configuration, from 0. */
  repeat: z.number().int().nonnegative(),
  /** The recorded run, so its replay and verdict can be opened. Absent when no run started. */
  runId: z.string().min(1).max(128).optional(),
  /** `resolved` when the tests pass, `unresolved` when they do not, `error` when the attempt could
   * not be judged (the agent could not start, or the tests could not run). */
  outcome: z.enum(benchOutcomes),
  runStatus: runStatusSchema.optional(),
  testsExitCode: z.number().int().nullable(),
  /** The end of the test output, for seeing why it failed. */
  testsOutput: z.string().max(3000),
  usage: tokenUsageSchema.optional(),
  /** Billed cost in cents when the account reports it. */
  costCents: z.number().nonnegative().nullable(),
  durationMs: z.number().nonnegative(),
  note: z.string().max(500).optional(),
});
export type BenchCell = z.infer<typeof benchCellSchema>;

export const benchResultSchema = z.strictObject({
  v: z.literal(benchVersion),
  id: slug,
  suiteId: slug,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  repeats: z.number().int().min(1).max(20),
  /** Caps applied to every run. */
  limits: z
    .strictObject({
      maxTokens: z.number().positive().optional(),
      maxSeconds: z.number().positive().optional(),
    })
    .optional(),
  configs: z.array(benchConfigSchema).min(1).max(20),
  cells: z.array(benchCellSchema),
});
export type BenchResult = z.infer<typeof benchResultSchema>;

/** US dollars per million tokens, for estimating cost when the account does not report it. */
export type TokenPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion?: number;
};

export function estimateCents(usage: TokenUsage, price: TokenPrice): number {
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cacheReadTokens);
  const dollars =
    (uncachedInput * price.inputPerMillion +
      usage.outputTokens * price.outputPerMillion +
      usage.cacheReadTokens * (price.cacheReadPerMillion ?? price.inputPerMillion)) /
    1_000_000;
  return dollars * 100;
}

/**
 * The 95% Wilson score interval for a pass rate. With the handful of tasks a bench has, a rate
 * like 3 of 4 is very uncertain, and the interval says how uncertain.
 */
export function wilsonInterval(resolved: number, attempts: number): { low: number; high: number } {
  if (attempts <= 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = resolved / attempts;
  const denominator = 1 + (z * z) / attempts;
  const centre = (p + (z * z) / (2 * attempts)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / attempts + (z * z) / (4 * attempts * attempts))) / denominator;
  return { low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) };
}

export type ConfigMetrics = {
  configId: string;
  attempts: number;
  resolved: number;
  unresolved: number;
  errors: number;
  /** Resolved attempts over all attempts. */
  passRate: number;
  passRateInterval: { low: number; high: number };
  totalTokens: number;
  /** All tokens spent, including failed attempts, divided by attempts that resolved. */
  tokensPerResolved: number | null;
  secondsPerResolved: number | null;
  /** Total spend over resolved attempts, in cents. Null when cost is unknown. */
  costPerResolvedCents: number | null;
  /** Where the cost came from: the account's billing, an estimate from a price table, or neither. */
  costSource: 'billed' | 'estimated' | 'unknown';
};

/** What each configuration achieved and what it cost. Failed attempts cost too, so they count. */
export function configMetrics(
  result: BenchResult,
  configId: string,
  prices: Record<string, TokenPrice> = {},
): ConfigMetrics {
  const config = result.configs.find((candidate) => candidate.id === configId);
  const cells = result.cells.filter((cell) => cell.configId === configId);
  const resolved = cells.filter((cell) => cell.outcome === 'resolved').length;
  const errors = cells.filter((cell) => cell.outcome === 'error').length;
  const totalTokens = cells.reduce((sum, cell) => sum + (cell.usage?.totalTokens ?? 0), 0);
  const totalMs = cells.reduce((sum, cell) => sum + cell.durationMs, 0);

  const allBilled = cells.length > 0 && cells.every((cell) => cell.costCents !== null);
  const price = config ? prices[config.model] : undefined;
  const allEstimable =
    cells.length > 0 && price !== undefined && cells.every((cell) => cell.usage !== undefined);
  let spend: number | null = null;
  let costSource: ConfigMetrics['costSource'] = 'unknown';
  if (allBilled) {
    spend = cells.reduce((sum, cell) => sum + (cell.costCents ?? 0), 0);
    costSource = 'billed';
  } else if (allEstimable && price) {
    spend = cells.reduce(
      (sum, cell) => sum + (cell.usage ? estimateCents(cell.usage, price) : 0),
      0,
    );
    costSource = 'estimated';
  }

  return {
    configId,
    attempts: cells.length,
    resolved,
    unresolved: cells.length - resolved - errors,
    errors,
    passRate: cells.length === 0 ? 0 : resolved / cells.length,
    passRateInterval: wilsonInterval(resolved, cells.length),
    totalTokens,
    tokensPerResolved: resolved === 0 ? null : totalTokens / resolved,
    secondsPerResolved: resolved === 0 ? null : totalMs / 1000 / resolved,
    costPerResolvedCents: resolved === 0 || spend === null ? null : spend / resolved,
    costSource,
  };
}

/** The configuration with the lowest cost per resolved task, or the lowest tokens when no cost is
 * known. Undefined when no configuration resolved anything. */
export function cheapestConfig(
  result: BenchResult,
  prices: Record<string, TokenPrice> = {},
): string | undefined {
  const rows = result.configs
    .map((config) => configMetrics(result, config.id, prices))
    .filter((metrics) => metrics.resolved > 0);
  const byCost = rows.filter((metrics) => metrics.costPerResolvedCents !== null);
  const pool = byCost.length === rows.length ? byCost : rows;
  const key = (metrics: ConfigMetrics) =>
    byCost.length === rows.length
      ? (metrics.costPerResolvedCents ?? Infinity)
      : (metrics.tokensPerResolved ?? Infinity);
  return pool.reduce<ConfigMetrics | undefined>(
    (best, row) => (!best || key(row) < key(best) ? row : best),
    undefined,
  )?.configId;
}
