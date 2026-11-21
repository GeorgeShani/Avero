import { configMetrics, type BenchResult, type BenchSuite } from '@avero/contracts';
import Link from 'next/link';
import { Panel } from '../console/primitives';
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
      <Panel
        title="Which setup resolves tasks cheapest"
        hint={`${tasks.length} task(s), ${result.repeats} repeat(s). Failed attempts are counted in what a resolved task cost.`}
        flush
      >
        <div data-scroll>
          <table data-table>
            <thead>
              <tr>
                <th scope="col">Setup</th>
                <th scope="col" data-num>
                  Resolved
                </th>
                <th scope="col">Pass rate</th>
                <th scope="col" data-num>
                  Tokens / resolved
                </th>
                <th scope="col" data-num>
                  Time / resolved
                </th>
                <th scope="col" data-num>
                  Cost / resolved
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ config, metrics }) => (
                <tr key={config.id}>
                  <th scope="row">{config.label}</th>
                  <td data-num>
                    {metrics.resolved}/{metrics.attempts}
                  </td>
                  <td style={{ minWidth: 200 }}>
                    <div data-setup style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                      <span
                        data-bar
                        role="img"
                        aria-label={`${percent(metrics.passRate)} resolved`}
                      >
                        <i style={{ width: `${metrics.passRate * 100}%` }} />
                      </span>
                      <span data-mono>{percent(metrics.passRate)}</span>
                    </div>
                    <span data-faint style={{ fontSize: 12 }}>
                      95% range {percent(metrics.passRateInterval.low)}–
                      {percent(metrics.passRateInterval.high)}
                    </span>
                  </td>
                  <td data-num>{tokens(metrics.tokensPerResolved)}</td>
                  <td data-num>{seconds(metrics.secondsPerResolved)}</td>
                  <td data-num>{cost(metrics.costPerResolvedCents, metrics.costSource)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p data-faint style={{ fontSize: 12, padding: '12px 16px' }}>
          Each setup has only {attempts} attempt(s), so a gap smaller than its range is not a
          result. Cost is shown only when Cursor reports it for your account.
        </p>
      </Panel>

      <Panel
        title="By task"
        hint="Each mark opens the recorded run: its replay and the reviewer's verdict."
        flush
      >
        <div data-scroll>
          <table data-table>
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
                              data-mark-box
                              data-outcome={cell.outcome}
                              title={outcomeWord[cell.outcome]}
                            >
                              {outcomeMark[cell.outcome]}
                              <span data-sr>{outcomeWord[cell.outcome]}</span>
                            </span>
                          );
                          return cell.runId ? (
                            <Link key={cell.repeat} href={`/runs/${cell.runId}`} data-cell>
                              {mark}
                            </Link>
                          ) : (
                            <span key={cell.repeat} data-cell>
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
      </Panel>
    </div>
  );
}
