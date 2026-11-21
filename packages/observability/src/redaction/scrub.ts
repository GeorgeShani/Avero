/**
 * Shapes of credentials that must never reach a log line, an error message shown to a person or a
 * span. This is a net for known shapes, not a guarantee: callers still pass only identifiers and
 * counts. (Exact known values are redacted separately by `redactSecrets` in `@avero/security`.)
 */
const shapes: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bsk_live_[A-Za-z0-9]{16,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  // A password or token inside a URL: https://user:secret@host
  /(?<=:\/\/)[^\s/:@]+:[^\s/@]+(?=@)/g,
  // key=value or "key": "value" for names that say they are secret
  /(?<=(?:api[_-]?key|secret|token|passw(?:or)?d|authorization)["']?\s*[:=]\s*["']?)[^\s"',;]{8,}/gi,
];

export const redactedMark = '[redacted]';

/** Replaces anything shaped like a credential. Returns the text unchanged when there is none. */
export function scrubSecrets(text: string): string {
  let result = text;
  for (const shape of shapes) result = result.replace(shape, redactedMark);
  return result;
}
