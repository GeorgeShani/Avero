import type { RunListItem } from '@avero/contracts';
import { Lcd, LcdDigits } from '@avero/ui';
import Link from 'next/link';
import { RunList } from './run-list';
import { formatMoney } from './replay';
import { overviewStats } from './stats';
import './runs.css';

function pad(value: number, width: number): string {
  return String(Math.min(value, 10 ** width - 1)).padStart(width, '0');
}

function seconds(ms: number | null): string {
  return ms === null ? 'none yet' : `${(ms / 1000).toFixed(1)} s`;
}

/** The front page of the console: totals and the latest runs, all read from recorded files. */
export function RunsOverview({
  runs,
  problems,
  dir,
}: {
  runs: RunListItem[];
  problems: { file: string; message: string }[];
  dir: string;
}) {
  const stats = overviewStats(runs);
  return (
    <div data-stack>
      <div data-rp="readouts" aria-label="Totals across recorded runs">
        <Lcd tag="Runs" size="sm">
          <LcdDigits value={pad(stats.runs, 3)} ghost="888" />
        </Lcd>
        <Lcd tag="Finished" size="sm">
          <LcdDigits value={pad(stats.finished, 3)} ghost="888" />
        </Lcd>
        <Lcd tag="Failed" size="sm">
          <LcdDigits value={pad(stats.failed, 3)} ghost="888" />
        </Lcd>
        <Lcd tag="To decide" size="sm">
          <LcdDigits value={pad(stats.awaitingDecision, 3)} ghost="888" />
        </Lcd>
        <Lcd tag="Tokens (k)" size="sm">
          <LcdDigits value={pad(Math.round(stats.totalTokens / 1000), 5)} ghost="88888" />
        </Lcd>
        <Lcd tag="Lines added" size="sm">
          <LcdDigits value={pad(stats.additions, 5)} ghost="88888" />
        </Lcd>
      </div>
      <p data-rp="dim">
        Average finished run: {seconds(stats.averageDurationMs)} · Billed cost:{' '}
        {formatMoney(stats.costCents ?? undefined)} · {stats.filesChanged} files changed in total ·{' '}
        {stats.awaitingRisky} of the {stats.awaitingDecision} runs awaiting a decision are medium or
        high risk
      </p>
      <RunList runs={runs.slice(0, 5)} problems={problems} dir={dir} />
      {runs.length > 5 && (
        <p data-rp="dim">
          Showing the latest 5 of {runs.length}.{' '}
          <Link href="/runs" data-rp="more">
            See all runs
          </Link>
        </p>
      )}
    </div>
  );
}
