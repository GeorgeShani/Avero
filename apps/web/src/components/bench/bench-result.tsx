import { configMetrics, type BenchResult, type BenchSuite } from '@avero/contracts';
import { Card } from '@avero/ui';
import Link from 'next/link';
import './bench.css';
import { cost, percent, seconds, tokens } from './format';

const outcomeMark = { resolved: '✓', unresolved: '✕', error: '!' } as const;
const outcomeWord = {
  resolved: 'resolved',
  unresolved: 'not resolved',
  error: 'could not be judged',
} as const;

export function BenchResultView({ suite, result }: { suite: BenchSuite; result: BenchResult }) {
  const rows = result.configs.map((config) => ({
    config,
    metrics: configMetrics(result, config.id),
  }));
  const attempts = rows[0]?.metrics.attempts ?? 0;
  // A run can cover only some of the suite's tasks (--task), so show just those.
  const ran = new Set(result.cells.map((cell) => cell.taskId));
  const tasks = suite.tasks.filter((task) => ran.has(task.id));

  return (
    <div data-stack>
      <Card
        title="Which setup resolves tasks cheapest"
        description={`${tasks.length} task(s), ${result.repeats} repeat(s). Failed attempts are counted in what a resolved task cost.`}
      >
        <div data-bn="scroll">
          <table data-bn="table">
            <thead>
              <tr>
                <th scope="col">Setup</th>
                <th scope="col">Resolved</th>
                <th scope="col">Pass rate (95% range)</th>
                <th scope="col">Tokens per resolved</th>
                <th scope="col">Time per resolved</th>
                <th scope="col">Cost per resolved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ config, metrics }) => (
                <tr key={config.id}>
                  <th scope="row">{config.label}</th>
                  <td>
                    {metrics.resolved}/{metrics.attempts}
                  </td>
                  <td>
                    {percent(metrics.passRate)}{' '}
                    <span data-bn="dim">
                      ({percent(metrics.passRateInterval.low)}–
                      {percent(metrics.passRateInterval.high)})
                    </span>
                  </td>
                  <td>{tokens(metrics.tokensPerResolved)}</td>
                  <td>{seconds(metrics.secondsPerResolved)}</td>
                  <td>{cost(metrics.costPerResolvedCents, metrics.costSource)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p data-bn="caveat">
          Each setup has only {attempts} attempt(s), so a gap smaller than its range is not a
          result. Cost is shown only when Cursor reports it for your account.
        </p>
      </Card>

      <Card
        title="By task"
        description="Each mark opens the recorded run: its replay and the reviewer's verdict."
      >
        <div data-bn="scroll">
          <table data-bn="table">
            <thead>
              <tr>
                <th scope="col">Task</th>
                {result.configs.map((config) => (
                  <th key={config.id} scope="col">
                    {config.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <th scope="row">{task.title}</th>
                  {result.configs.map((config) => (
                    <td key={config.id}>
                      {result.cells
                        .filter((cell) => cell.taskId === task.id && cell.configId === config.id)
                        .map((cell) => {
                          const mark = (
                            <span
                              data-bn="mark"
                              data-outcome={cell.outcome}
                              title={outcomeWord[cell.outcome]}
                            >
                              {outcomeMark[cell.outcome]}
                              <span data-bn="sr">{outcomeWord[cell.outcome]}</span>
                            </span>
                          );
                          return cell.runId ? (
                            <Link key={cell.repeat} href={`/runs/${cell.runId}`} data-bn="cell">
                              {mark}
                            </Link>
                          ) : (
                            <span key={cell.repeat} data-bn="cell">
                              {mark}
                            </span>
                          );
                        })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
