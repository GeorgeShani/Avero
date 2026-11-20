import type { RunSummary } from '@avero/contracts';

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
