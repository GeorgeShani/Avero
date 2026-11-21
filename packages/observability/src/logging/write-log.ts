import process from 'node:process';
import { trace } from '@opentelemetry/api';
import { scrubSecrets } from '../redaction/scrub.ts';

/** Longest string value a log line carries. Logs hold identifiers and counts, not content. */
const maxValueLength = 300;

/**
 * Writes one JSON line. Callers pass identifiers and counts only; as a net, string values are cut
 * to a short length and anything shaped like a credential is replaced. When a span is active its
 * ids are added, so a log line can be found from its trace and the other way round.
 */
export function writeLog(
  level: 'info' | 'error',
  event: string,
  details: Record<string, string | number> = {},
): void {
  const output = level === 'error' ? process.stderr : process.stdout;
  const safe: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(details)) {
    safe[key] = typeof value === 'string' ? scrubSecrets(value.slice(0, maxValueLength)) : value;
  }
  const span = trace.getActiveSpan()?.spanContext();
  const ids =
    span && trace.isSpanContextValid(span) ? { traceId: span.traceId, spanId: span.spanId } : {};
  output.write(
    JSON.stringify({ ...safe, ...ids, at: new Date().toISOString(), level, event }) + '\n',
  );
}
