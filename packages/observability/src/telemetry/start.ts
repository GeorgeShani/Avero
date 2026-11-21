import { metrics, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { context } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  type MetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

export type TelemetryOptions = {
  /** `avero-web`, `avero-worker` and so on: how this process shows up in a trace backend. */
  serviceName: string;
  version?: string;
  /** The environment, usually `process.env`. Telemetry starts only when an OTLP endpoint is set. */
  environment?: Record<string, string | undefined>;
  /** Replace the exporters (tests). When given, telemetry starts without an endpoint. */
  spanProcessors?: SpanProcessor[];
  metricReaders?: MetricReader[];
};

export type Telemetry = { enabled: boolean; shutdown: () => Promise<void> };

const off: Telemetry = { enabled: false, shutdown: async () => undefined };

/**
 * Starts tracing and metrics for this process and sends them to the OTLP endpoint in
 * `OTEL_EXPORTER_OTLP_ENDPOINT` (for example `http://collector:4318`). Without an endpoint it does
 * nothing and the instrumentation stays inert. Returns a `shutdown` that flushes what is pending:
 * call it before the process exits.
 */
export function startTelemetry(options: TelemetryOptions): Telemetry {
  const environment = options.environment ?? process.env;
  const endpoint = environment.OTEL_EXPORTER_OTLP_ENDPOINT?.trim().replace(/\/$/, '');
  const injected = options.spanProcessors || options.metricReaders;
  if (!endpoint && !injected) return off;

  const resource = resourceFromAttributes({
    'service.name': options.serviceName,
    ...(options.version ? { 'service.version': options.version } : {}),
    ...(environment.NODE_ENV ? { 'deployment.environment.name': environment.NODE_ENV } : {}),
  });

  const tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: options.spanProcessors ?? [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })),
    ],
  });
  const meterProvider = new MeterProvider({
    resource,
    readers: options.metricReaders ?? [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: 15_000,
      }),
    ],
  });

  // Without a context manager, a span started inside another is not its child.
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(tracerProvider);
  metrics.setGlobalMeterProvider(meterProvider);

  return {
    enabled: true,
    async shutdown() {
      await tracerProvider.shutdown().catch(() => undefined);
      await meterProvider.shutdown().catch(() => undefined);
      trace.disable();
      metrics.disable();
      context.disable();
    },
  };
}
