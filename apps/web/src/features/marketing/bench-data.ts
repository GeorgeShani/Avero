import { configMetrics } from '@avero/contracts';
import { exampleBench } from './example-review';

export type SetupRow = {
  id: string;
  /** Short, for a control: whether a rules file was part of the setup. */
  label: string;
  resolved: number;
  attempts: number;
  passRate: number;
  tokensPerResolved: number | null;
  secondsPerResolved: number | null;
  /** Task title and outcome for this setup. */
  tasks: { title: string; outcome: 'resolved' | 'unresolved' | 'error' }[];
};

/** The real bench result as one row per setup. */
export const setups: SetupRow[] = exampleBench.result.configs.map((config) => {
  const metrics = configMetrics(exampleBench.result, config.id);
  return {
    id: config.id,
    label: config.rules.length === 0 ? 'No rules file' : 'With rules file',
    resolved: metrics.resolved,
    attempts: metrics.attempts,
    passRate: metrics.passRate,
    tokensPerResolved: metrics.tokensPerResolved,
    secondsPerResolved: metrics.secondsPerResolved,
    tasks: exampleBench.tasks.map((task) => ({
      title: task.title,
      outcome:
        exampleBench.result.cells.find(
          (cell) => cell.taskId === task.id && cell.configId === config.id,
        )?.outcome ?? 'error',
    })),
  };
});

/** The setup that spent the fewest tokens per resolved task. Null when none resolved anything. */
export function cheapestSetup(rows: readonly SetupRow[] = setups): SetupRow | null {
  const priced = rows.filter((row) => row.tokensPerResolved !== null);
  if (priced.length === 0) return null;
  return priced.reduce((a, b) =>
    (a.tokensPerResolved ?? 0) <= (b.tokensPerResolved ?? 0) ? a : b,
  );
}
