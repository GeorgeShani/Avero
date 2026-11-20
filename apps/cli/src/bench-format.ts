import {
  configMetrics,
  type BenchResult,
  type BenchSuite,
  type ConfigMetrics,
  type TokenPrice,
} from '@avero/contracts';
import { formatDuration, formatTokens } from './format.ts';

const percent = (value: number) => `${Math.round(value * 100)}%`;

function costText(metrics: ConfigMetrics): string {
  if (metrics.costPerResolvedCents === null) return 'unknown';
  const dollars = metrics.costPerResolvedCents / 100;
  const text = `$${dollars.toFixed(dollars < 1 ? 3 : 2)}`;
  return metrics.costSource === 'estimated' ? `${text} (estimated)` : text;
}

/** Parses `--prices model=input,output[,cacheRead]` (US dollars per million tokens). */
export function parsePrices(specs: readonly string[]): Record<string, TokenPrice> | string {
  const prices: Record<string, TokenPrice> = {};
  for (const spec of specs) {
    const [model, numbers] = spec.split('=');
    const [input, output, cache] = (numbers ?? '').split(',').map(Number);
    if (
      !model ||
      input === undefined ||
      output === undefined ||
      !Number.isFinite(input) ||
      !Number.isFinite(output) ||
      input < 0 ||
      output < 0
    ) {
      return `Could not read the price "${spec}". Use model=inputPerMillion,outputPerMillion (dollars), for example composer-2.5=0.5,2.5.`;
    }
    prices[model] = {
      inputPerMillion: input,
      outputPerMillion: output,
      ...(cache !== undefined && Number.isFinite(cache) ? { cacheReadPerMillion: cache } : {}),
    };
  }
  return prices;
}

/**
 * A result as terminal lines: one row per configuration (pass rate with its uncertainty, and what
 * each resolved task cost, counting the failed attempts too), then each task's outcome per
 * configuration.
 */
export function describeBench(
  result: BenchResult,
  suite: BenchSuite | undefined,
  prices: Record<string, TokenPrice> = {},
): string[] {
  const lines: string[] = [];
  const rows = result.configs.map((config) => ({
    config,
    metrics: configMetrics(result, config.id, prices),
  }));
  const width = Math.max(...rows.map((row) => row.config.label.length), 6);

  lines.push(
    `${'Setup'.padEnd(width)}  Resolved  Pass rate (95% range)   Tokens/resolved  Time/resolved  Cost/resolved`,
  );
  for (const { config, metrics } of rows) {
    const range = `${percent(metrics.passRateInterval.low)}–${percent(metrics.passRateInterval.high)}`;
    lines.push(
      [
        config.label.padEnd(width),
        `${metrics.resolved}/${metrics.attempts}`.padEnd(8),
        `${percent(metrics.passRate)} (${range})`.padEnd(22),
        (metrics.tokensPerResolved === null
          ? 'n/a'
          : formatTokens(Math.round(metrics.tokensPerResolved))
        ).padEnd(15),
        (metrics.secondsPerResolved === null
          ? 'n/a'
          : formatDuration(metrics.secondsPerResolved * 1000)
        ).padEnd(13),
        costText(metrics),
      ].join('  '),
    );
    if (metrics.errors > 0)
      lines.push(
        `${' '.repeat(width)}  ${metrics.errors} attempt(s) could not be judged (errors), counted as not resolved.`,
      );
  }

  const tasks = suite
    ? suite.tasks.map((task) => ({ id: task.id, title: task.title }))
    : [...new Set(result.cells.map((cell) => cell.taskId))].map((id) => ({ id, title: id }));
  lines.push('', 'By task (✓ resolved, ✕ not resolved, ! could not be judged):');
  for (const task of tasks) {
    const marks = result.configs
      .map((config) => {
        const cells = result.cells.filter(
          (cell) => cell.taskId === task.id && cell.configId === config.id,
        );
        return (
          cells
            .map((cell) =>
              cell.outcome === 'resolved' ? '✓' : cell.outcome === 'error' ? '!' : '✕',
            )
            .join('') || '·'
        );
      })
      .join('  ');
    lines.push(`  ${marks.padEnd(result.configs.length * 4)} ${task.title}`);
  }
  lines.push(
    '',
    `Pass rates come from only ${rows[0]?.metrics.attempts ?? 0} attempts per setup, so a gap smaller than the range is not a result. Costs include every failed attempt.`,
  );
  return lines;
}
