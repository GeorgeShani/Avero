import { configMetrics } from '@avero/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCommand } from '../../../components/console/copy-command';
import {
  Empty,
  Note,
  PageHead,
  Panel,
  RiskTag,
  Stat,
  Term,
} from '../../../components/console/primitives';
import { Checklist } from '../../../features/overview/checklist';
import {
  isComplete,
  localSteps,
  nextStep,
  workspaceSteps,
  type SetupInput,
  type SetupStep,
} from '../../../features/overview/setup-status';
import type { WorkspaceSummary } from '../../../features/overview/workspace-summary';
import { awaitingDecision } from '../../../features/review/queue';
import { RunsTable } from '../../../features/runs/runs-table';
import { overviewStats } from '../../../features/runs/stats';
import { compact, seconds, stamp } from '../../../lib/format';
import { loadLatestBench, loadSuites } from '../../../server/bench';
import { serverCapabilities } from '../../../server/capabilities';
import { loadHostedState, loadWorkspaceSummary } from '../../../server/console-context';
import { loadRuns } from '../../../server/runs';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

/** The selected workspace's counts, or nothing when nobody is signed in to one or it cannot be read. */
async function workspaceSummary(
  hosted: Awaited<ReturnType<typeof loadHostedState>>,
): Promise<{ name: string; summary: WorkspaceSummary } | undefined> {
  if (hosted.status !== 'signed-in' || !hosted.selectedId) return undefined;
  const chosen = hosted.workspaces.find((item) => item.id === hosted.selectedId);
  if (!chosen) return undefined;
  try {
    return { name: chosen.name, summary: await loadWorkspaceSummary(chosen.id, chosen.name) };
  } catch {
    return undefined;
  }
}

function NextStep({ step, track }: { step: SetupStep; track: string }) {
  return (
    <Note title={`Next on ${track}:`}>
      {step.title}.{' '}
      {step.href ? (
        <Link href={step.href}>{step.hrefLabel ?? 'Open'}</Link>
      ) : step.command ? (
        <code>{step.command}</code>
      ) : null}
    </Note>
  );
}

export default async function OverviewPage() {
  const [{ runs, problems, dir }, bench, { suites }, hosted] = await Promise.all([
    loadRuns(),
    loadLatestBench(),
    loadSuites(),
    loadHostedState(),
  ]);
  const workspace = await workspaceSummary(hosted);
  const stats = overviewStats(runs);
  const waiting = awaitingDecision(runs);
  const rows = bench
    ? bench.result.configs.map((config) => ({
        config,
        metrics: configMetrics(bench.result, config.id),
      }))
    : [];

  const setup: SetupInput = {
    runs: {
      total: runs.length,
      reviewed: runs.filter((run) => run.review.risk).length,
      decided: runs.filter((run) => run.review.decision).length,
      firstRunId: runs[0]?.runId,
    },
    suites: suites.length,
    cursorKey: serverCapabilities().cursorKey,
    hosted,
    workspace: workspace?.summary,
  };
  const local = localSteps(setup);
  const team = workspaceSteps(setup);
  const teamAvailable = hosted.status !== 'unavailable';

  // Nothing recorded anywhere yet: the page is a guide, not a set of empty totals.
  const firstRun = runs.length === 0 && !bench && (workspace?.summary.tasks.total ?? 0) === 0;

  const head = (
    <PageHead title="Overview">
      What the agents did on this machine, what needs your decision, and how your{' '}
      <Term k="setup">setups</Term> compare. These totals are read from files on this machine;
      nothing is simulated.
    </PageHead>
  );

  if (firstRun) {
    return (
      <>
        {head}
        {problems.length > 0 && (
          <Note tone="warn" title={`${problems.length} file(s) could not be read as runs.`}>
            {problems.map((problem) => `${problem.file}: ${problem.message}`).join(' · ')}
          </Note>
        )}
        <Note title="Nothing is recorded yet.">
          Avero records what a coding agent does, replays it, has a second agent review it, and
          leaves the decision to you. There are two ways to start, and you can do either.
        </Note>
        <div data-stack>
          <Panel
            title="On this machine"
            hint="Needs nothing but the command line. Runs are saved as files."
            flush
          >
            <Checklist steps={local} label="Steps on this machine" />
          </Panel>
          <Panel
            title="With a team workspace"
            hint={
              teamAvailable
                ? 'Launch agents from the browser, shared with your team'
                : 'Not set up on this server'
            }
            flush
          >
            <Checklist steps={team} label="Steps for a team workspace" />
          </Panel>
        </div>
      </>
    );
  }

  const nextLocal = isComplete(local) ? undefined : nextStep(local);
  const nextTeam = teamAvailable && workspace && !isComplete(team) ? nextStep(team) : undefined;

  return (
    <>
      {head}

      {problems.length > 0 && (
        <Note tone="warn" title={`${problems.length} file(s) could not be read as runs.`}>
          {problems.map((problem) => `${problem.file}: ${problem.message}`).join(' · ')}
        </Note>
      )}

      {nextLocal && <NextStep step={nextLocal} track="this machine" />}
      {nextTeam && <NextStep step={nextTeam} track="your workspace" />}

      <dl data-stats aria-label="Totals">
        <Stat
          label="Runs"
          value={stats.runs}
          note={`${stats.finished} finished · ${stats.failed} failed${stats.stopped > 0 ? ` · ${stats.stopped} stopped` : ''}`}
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
          title="Evaluations"
          hint={
            bench
              ? `${bench.suite.id} · ${stamp(bench.result.startedAt)}`
              : 'Which setup resolves tasks cheapest'
          }
          action={
            bench
              ? { href: `/evaluations/${bench.suite.id}/${bench.result.id}`, label: 'Open result' }
              : { href: '/evaluations', label: 'Evaluations' }
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
            <Empty title="No evaluation results yet.">
              <span>Build tasks from your repository&apos;s own history, then compare setups.</span>
              <CopyCommand command={'pnpm avero bench init --repo . --test "npm test"'} />
            </Empty>
          )}
        </Panel>
      </div>

      {workspace && (
        <Panel
          title={`Workspace: ${workspace.name}`}
          hint="Tasks launched from the browser, run by a worker"
          action={{ href: '/tasks', label: 'Tasks' }}
        >
          <dl data-stats aria-label="This workspace">
            <Stat
              label="Active tasks"
              value={workspace.summary.tasks.active}
              note={`${workspace.summary.tasks.queued} waiting for the worker`}
            />
            <Stat
              label="To decide"
              value={workspace.summary.toDecide}
              tone={workspace.summary.risky > 0 ? 'warn' : undefined}
              note={
                workspace.summary.risky > 0
                  ? `${workspace.summary.risky} medium or high risk`
                  : 'finished runs'
              }
            />
            <Stat
              label="Finished"
              value={workspace.summary.tasks.finished}
              note={`of ${workspace.summary.tasks.total} tasks`}
            />
            <Stat
              label="Failed"
              value={workspace.summary.tasks.failed}
              tone={workspace.summary.tasks.failed > 0 ? 'warn' : undefined}
            />
          </dl>
        </Panel>
      )}

      <Panel
        title="Recent runs"
        hint={`Read from ${dir}`}
        action={runs.length > 6 ? { href: '/runs', label: `All ${runs.length} runs` } : undefined}
        flush
      >
        {runs.length === 0 ? (
          <Empty title="No runs on this machine yet.">
            <span>Record one with a Cursor agent. It edits the folder you point it at.</span>
            <CopyCommand
              command={'pnpm avero run "fix the flaky retry test" --cwd <your repository>'}
            />
          </Empty>
        ) : (
          <RunsTable runs={runs.slice(0, 6)} />
        )}
      </Panel>
    </>
  );
}
