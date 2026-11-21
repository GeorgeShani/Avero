import { configMetrics } from '@avero/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { awaitingDecision } from '../../../features/review/queue';
import {
  Empty,
  Note,
  PageHead,
  Panel,
  RiskTag,
  Stat,
} from '../../../components/console/primitives';
import { RunsTable } from '../../../features/runs/runs-table';
import { overviewStats } from '../../../features/runs/stats';
import { loadLatestBench } from '../../../server/bench';
import { loadRuns } from '../../../server/runs';
import { compact, seconds, stamp } from '../../../lib/format';

export const metadata: Metadata = { title: 'Desk' };
export const dynamic = 'force-dynamic';

export default async function DeskPage() {
  const [{ runs, problems, dir }, bench] = await Promise.all([loadRuns(), loadLatestBench()]);
  const stats = overviewStats(runs);
  const waiting = awaitingDecision(runs);
  const rows = bench
    ? bench.result.configs.map((config) => ({
        config,
        metrics: configMetrics(bench.result, config.id),
      }))
    : [];

  return (
    <>
      <PageHead title="Desk">
        What the agents did on this machine, what needs your decision, and how your setups compare.
        Everything here is read from files; nothing is simulated.
      </PageHead>

      {problems.length > 0 && (
        <Note tone="warn" title={`${problems.length} file(s) could not be read as runs.`}>
          {problems.map((problem) => `${problem.file}: ${problem.message}`).join(' · ')}
        </Note>
      )}

      <dl data-stats aria-label="Totals">
        <Stat
          label="Runs"
          value={stats.runs}
          note={`${stats.finished} finished · ${stats.failed} failed`}
        />
        <Stat
          label="To decide"
          value={stats.awaitingDecision}
          tone={stats.awaitingRisky > 0 ? 'warn' : undefined}
          note={
            stats.awaitingRisky > 0
              ? `${stats.awaitingRisky} medium or high risk`
              : 'nothing risky waiting'
          }
        />
        <Stat
          label="Tokens"
          value={compact(stats.totalTokens)}
          note={
            stats.costCents === null
              ? 'billed cost not reported'
              : `$${(stats.costCents / 100).toFixed(2)} billed`
          }
        />
        <Stat
          label="Changed"
          value={`${stats.filesChanged} files`}
          note={
            <>
              <span data-add>+{stats.additions}</span> <span data-del>−{stats.deletions}</span>
            </>
          }
        />
        <Stat
          label="Average run"
          value={stats.averageDurationMs === null ? '–' : seconds(stats.averageDurationMs)}
          note="finished runs"
        />
      </dl>

      <div data-grid="two">
        <Panel
          title="Needs your decision"
          hint="Finished runs without a decision, riskiest first"
          action={{ href: '/review', label: 'Review queue' }}
          flush
        >
          {waiting.length === 0 ? (
            <Empty title="Nothing is waiting.">
              <span>Finished runs appear here until you approve, reject or ask for changes.</span>
            </Empty>
          ) : (
            <ul data-items>
              {waiting.slice(0, 5).map((run) => (
                <li key={run.runId}>
                  {run.review.risk ? (
                    <RiskTag tier={run.review.risk} />
                  ) : (
                    <span data-tag data-tone="quiet">
                      not reviewed
                    </span>
                  )}
                  <div data-item-main>
                    <Link href={`/runs/${run.runId}`} data-item-title>
                      {run.task}
                    </Link>
                    <span data-item-meta>
                      {run.model} · {stamp(run.startedAt)} · {run.filesChanged} files
                      {run.review.failedChecks
                        ? ` · ${run.review.failedChecks} failed check(s)`
                        : ''}
                    </span>
                  </div>
                  <span data-dim data-mono>
                    {seconds(run.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Bench"
          hint={
            bench
              ? `${bench.suite.id} · ${stamp(bench.result.startedAt)}`
              : 'Which setup resolves tasks cheapest'
          }
          action={
            bench
              ? { href: `/bench/${bench.suite.id}/${bench.result.id}`, label: 'Open result' }
              : { href: '/bench', label: 'Bench' }
          }
        >
          {bench ? (
            <div data-stack>
              {rows.map(({ config, metrics }) => (
                <div key={config.id} data-setup>
                  <span>{config.label}</span>
                  <span data-mono data-dim style={{ textAlign: 'right' }}>
                    {metrics.resolved}/{metrics.attempts}
                  </span>
                  <span
                    data-bar
                    role="img"
                    aria-label={`${Math.round(metrics.passRate * 100)} percent resolved`}
                  >
                    <i style={{ width: `${metrics.passRate * 100}%` }} />
                  </span>
                </div>
              ))}
              <p data-faint style={{ fontSize: 12 }}>
                {rows[0]?.metrics.attempts ?? 0} attempts per setup. A gap smaller than the range on
                the result page is not a result.
              </p>
            </div>
          ) : (
            <Empty title="No bench results yet.">
              <span>Build tasks from your repository&apos;s own history, then compare setups.</span>
              <pre data-cmd>pnpm avero bench init --repo . --test &quot;npm test&quot;</pre>
            </Empty>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent runs"
        hint={`Read from ${dir}`}
        action={runs.length > 6 ? { href: '/runs', label: `All ${runs.length} runs` } : undefined}
        flush
      >
        {runs.length === 0 ? (
          <Empty title="No runs yet.">
            <span>Record one with a Cursor agent. It edits the folder you point it at.</span>
            <pre data-cmd>
              pnpm avero run &quot;fix the flaky retry test&quot; --cwd &lt;your repository&gt;
            </pre>
          </Empty>
        ) : (
          <RunsTable runs={runs.slice(0, 6)} />
        )}
      </Panel>
    </>
  );
}
