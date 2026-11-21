// Plain text formatting shared by the console and the bench pages. No React here.

export function seconds(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

/** UTC in a fixed format, not the viewer's locale, so the server and the browser print the same text. */
export function stamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return value.toLocaleString('en-US');
}

export const percent = (value: number) => `${Math.round(value * 100)}%`;

export function tokens(value: number | null): string {
  if (value === null) return 'n/a';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

export function secondsLabel(value: number | null): string {
  if (value === null) return 'n/a';
  return value < 60
    ? `${value.toFixed(1)} s`
    : `${Math.floor(value / 60)} min ${Math.round(value % 60)} s`;
}

/** Cost per resolved task: billed, estimated from a price table, or honestly unknown. */
export function cost(cents: number | null, source: 'billed' | 'estimated' | 'unknown'): string {
  if (cents === null) return 'unknown';
  const dollars = cents / 100;
  const text = `$${dollars.toFixed(dollars < 1 ? 3 : 2)}`;
  return source === 'estimated' ? `${text} (estimated)` : text;
}
