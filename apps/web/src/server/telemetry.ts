import 'server-only';
import { startTelemetry } from '@avero/observability';

/**
 * Starts traces and metrics for the web server. Does nothing unless OTEL_EXPORTER_OTLP_ENDPOINT is
 * set. Next.js records its own request spans once a tracer is registered.
 */
export function startWebTelemetry() {
  return startTelemetry({ serviceName: 'avero-web', environment: process.env });
}
