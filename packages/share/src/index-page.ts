import type { RunListItem } from '@avero/contracts';
import { escapeHtml, staticPageCsp } from './page.ts';
import { baseCss, indexCss } from './styles.ts';

export type IndexPageOptions = {
  title?: string;
  /** Files in the folder that could not be read as run records, with the reason. */
  problems?: { file: string; message: string }[];
};

const decisionWords: Record<string, string> = {
  approved: 'Approved',
  'changes-requested': 'Changes requested',
  rejected: 'Rejected',
};

function seconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function pill(text: string, tone?: 'good' | 'warn' | 'bad'): string {
  return `<span class="pill"${tone ? ` data-tone="${tone}"` : ''}>${escapeHtml(text)}</span>`;
}

function statusPill(status: RunListItem['status']): string {
  const tone =
    status === 'FINISHED' ? 'good' : status === 'ERROR' || status === 'EXPIRED' ? 'bad' : 'warn';
  return pill(status.toLowerCase(), tone);
}

function riskPill(review: RunListItem['review']): string {
  if (!review.risk) return '<span class="dim">no review</span>';
  const tone = review.risk === 'low' ? 'good' : review.risk === 'medium' ? 'warn' : 'bad';
  const failed = review.failedChecks ? ` · ${review.failedChecks} failed` : '';
  return pill(`${review.risk} risk${failed}`, tone);
}

function decisionPill(review: RunListItem['review']): string {
  if (!review.decision) return '<span class="dim">undecided</span>';
  const tone =
    review.decision === 'approved' ? 'good' : review.decision === 'rejected' ? 'bad' : 'warn';
  return pill(decisionWords[review.decision] ?? review.decision, tone);
}

function row(run: RunListItem): string {
  const href = `runs/${encodeURIComponent(run.runId)}`;
  const changes =
    run.filesChanged > 0 ? `${run.filesChanged} files +${run.additions} −${run.deletions}` : '–';
  return `<tr>
<td class="task"><a href="${escapeHtml(href)}">${escapeHtml(run.task.replace(/\s+/g, ' ').slice(0, 200))}</a><small>${escapeHtml(run.runId)} · ${escapeHtml(run.model)} · ${escapeHtml(run.startedAt.slice(0, 16).replace('T', ' '))} UTC</small></td>
<td>${statusPill(run.status)}</td>
<td>${riskPill(run.review)}</td>
<td>${decisionPill(run.review)}</td>
<td class="num">${escapeHtml(seconds(run.durationMs))}</td>
<td class="num">${escapeHtml(run.totalTokens.toLocaleString('en-US'))}</td>
<td class="num">${run.toolCalls}</td>
<td class="num">${escapeHtml(changes)}</td>
</tr>`;
}

/**
 * A list of runs, as one self-contained page with no script. Each run links to `runs/<id>`, which
 * the local server answers with the run's replay.
 */
export function renderIndexPage(runs: RunListItem[], options: IndexPageOptions = {}): string {
  const title = options.title ?? 'Avero runs';
  const undecided = runs.filter((run) => run.status === 'FINISHED' && !run.review.decision).length;
  const problems = options.problems ?? [];
  const table =
    runs.length === 0
      ? `<p class="card empty">No runs here yet. Record one with <code>avero run "your task"</code>.</p>`
      : `<div class="table-wrap"><table>
<thead><tr><th scope="col">Task</th><th scope="col">Status</th><th scope="col">Risk</th><th scope="col">Decision</th><th scope="col" class="num">Time</th><th scope="col" class="num">Tokens</th><th scope="col" class="num">Calls</th><th scope="col" class="num">Changes</th></tr></thead>
<tbody>
${runs.map(row).join('\n')}
</tbody>
</table></div>`;
  const broken =
    problems.length === 0
      ? ''
      : `<section class="card problems"><h2>Files that could not be read</h2><ul>${problems
          .map(
            (problem) =>
              `<li><code>${escapeHtml(problem.file)}</code> ${escapeHtml(problem.message)}</li>`,
          )
          .join('')}</ul></section>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${staticPageCsp}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="referrer" content="no-referrer" />
<title>${escapeHtml(title)}</title>
<style>${baseCss}${indexCss}</style>
</head>
<body>
<main class="page">
<header>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${runs.length} ${runs.length === 1 ? 'run' : 'runs'}${undecided > 0 ? ` · ${undecided} finished and not yet decided` : ''}</p>
</header>
${table}
${broken}
<p class="foot">Read-only view of your local run records.</p>
</main>
</body>
</html>
`;
}
