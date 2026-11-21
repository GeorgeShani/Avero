import { SpanStatusCode, trace, type Span } from '@opentelemetry/api';

type Attributes = Record<string, string | number | boolean>;

const tracerName = 'avero';
/** Same limit as the log lines: a span carries identifiers and counts, not content. */
const maxValueLength = 200;

function cut(attributes: Attributes): Attributes {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.slice(0, maxValueLength) : value,
    ]),
  );
}

/**
 * Runs `work` inside a span. Spans started inside it are its children. If `work` throws, the span is
 * marked as failed with the error's class name only (never its message or stack, which can carry
 * paths and secrets) and the error is rethrown. Without a registered SDK this costs almost nothing.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  work: (span: Span) => Promise<T>,
): Promise<T> {
  return trace
    .getTracer(tracerName)
    .startActiveSpan(name, { attributes: cut(attributes) }, async (span) => {
      try {
        return await work(span);
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute('error.type', error instanceof Error ? error.name : 'unknown');
        throw error;
      } finally {
        span.end();
      }
    });
}

/** Adds attributes to a span, with the same length limit. */
export function setSpanAttributes(span: Span, attributes: Attributes): void {
  span.setAttributes(cut(attributes));
}
