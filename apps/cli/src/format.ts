import { checkCounts, type RunSummary, type Verdict } from '@avero/contracts';

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`;
}

export function formatCost(cents: number | null): string {
  return cents === null ? 'not reported' : `$${(cents / 100).toFixed(cents < 100 ? 3 : 2)}`;
}

export function formatTokens(tokens: number): string {
  return tokens >= 10_000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens);
}

export function describeStatus(summary: RunSummary): string {
  return [
    summary.status,
    formatDuration(summary.durationMs),
    `${formatTokens(summary.totalTokens)} tokens`,
    formatCost(summary.costCents),
    `${summary.filesChanged} files +${summary.additions} -${summary.deletions}`,
  ].join(' · ');
}

const marks = { pass: '✓', fail: '✕', unclear: '?' } as const;

/** A verdict as terminal lines: the risk, each check with its evidence, and what Avero corrected. */
export function describeVerdict(verdict: Verdict): string[] {
  const counts = checkCounts(verdict);
  const lines = [
    `Risk ${verdict.risk.tier.toUpperCase()} · ${counts.pass} pass, ${counts.fail} fail, ${counts.unclear} unclear · reviewed by ${verdict.reviewer.model}`,
    verdict.summary,
    '',
  ];
  for (const check of verdict.checks) {
    lines.push(`  ${marks[check.verdict]} ${check.claim}`, `      ${check.evidence}`);
  }
  if (verdict.outOfScope.length > 0) {
    lines.push('', 'Outside the task:');
    for (const entry of verdict.outOfScope) lines.push(`  ${entry.path}: ${entry.reason}`);
  }
  const tests = verdict.tests.ran ? (verdict.tests.passed ? 'ran and passed' : 'ran') : 'not run';
  lines.push('', `Tests: ${tests}. ${verdict.tests.evidence}`);
  if (verdict.risk.reasons.length > 0) lines.push(`Risk: ${verdict.risk.reasons.join(' ')}`);
  if (verdict.adjustments.length > 0) {
    lines.push('', 'Avero corrected the reviewer:');
    for (const adjustment of verdict.adjustments) lines.push(`  ${adjustment}`);
  }
  return lines;
}
