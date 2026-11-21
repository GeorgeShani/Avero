import process from 'node:process';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeLog } from '../logging/write-log.ts';
import {
  recordGuardDenied,
  recordOutboxPublished,
  recordRecovery,
  recordTaskSettled,
} from '../metrics/index.ts';
import { withSpan } from '../tracing/index.ts';
import { startTelemetry, type Telemetry } from './start.ts';

let telemetry: Telemetry | undefined;
afterEach(async () => {
  await telemetry?.shutdown();
  telemetry = undefined;
  vi.restoreAllMocks();
});

function start() {
  const spans = new InMemorySpanExporter();
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 60_000,
  });
  telemetry = startTelemetry({
    serviceName: 'avero-test',
    spanProcessors: [new SimpleSpanProcessor(spans)],
    metricReaders: [reader],
  });
  return { spans, exporter, reader };
}

describe('startTelemetry', () => {
  it('stays off without an endpoint, and the instrumentation does nothing', async () => {
    const result = startTelemetry({ serviceName: 'x', environment: {} });
    expect(result.enabled).toBe(false);
    await expect(withSpan('noop', {}, async () => 7)).resolves.toBe(7);
    recordTaskSettled('finished', 5);
    await result.shutdown();
  });
});

describe('withSpan', () => {
  it('records spans with their attributes, and nests a span started inside another', async () => {
    const { spans } = start();
    await withSpan('task.run', { taskId: 't1', attempt: 1 }, async () => {
      await withSpan('task.checkout', { kind: 'local' }, async () => undefined);
    });
    const finished = spans.getFinishedSpans();
    const parent = finished.find((span) => span.name === 'task.run');
    const child = finished.find((span) => span.name === 'task.checkout');
    expect(parent?.attributes).toMatchObject({ taskId: 't1', attempt: 1 });
    expect(child?.parentSpanContext?.spanId).toBe(parent?.spanContext().spanId);
    expect(child?.spanContext().traceId).toBe(parent?.spanContext().traceId);
    expect(parent?.resource.attributes['service.name']).toBe('avero-test');
  });

  it('marks a failed span with the error class only, never its message', async () => {
    const { spans } = start();
    const secretMessage = 'the token was ' + ['ghp', '_', 'a'.repeat(36)].join('');
    await expect(
      withSpan('task.run', {}, async () => {
        throw new TypeError(secretMessage);
      }),
    ).rejects.toThrow(TypeError);
    const [span] = spans.getFinishedSpans();
    expect(span?.status.code).toBe(2);
    expect(span?.attributes['error.type']).toBe('TypeError');
    expect(JSON.stringify({ attributes: span?.attributes, status: span?.status })).not.toContain(
      'ghp_',
    );
    expect(span?.events).toEqual([]);
  });

  it('cuts long string attributes', async () => {
    const { spans } = start();
    await withSpan('x', { text: 'a'.repeat(1000) }, async () => undefined);
    expect(String(spans.getFinishedSpans()[0]?.attributes.text)).toHaveLength(200);
  });
});

describe('metrics', () => {
  it('counts tasks, outbox rows, recoveries and refused commands', async () => {
    const { exporter, reader } = start();
    recordTaskSettled('finished', 120);
    recordTaskSettled('failed');
    recordOutboxPublished(3);
    recordOutboxPublished(0);
    recordRecovery({ requeued: 2, failed: 1, cancelled: 0 });
    recordGuardDenied(4);
    await reader.forceFlush();

    const points = new Map<string, { attributes: Record<string, unknown>; value: unknown }[]>();
    for (const resource of exporter.getMetrics())
      for (const scope of resource.scopeMetrics)
        for (const metric of scope.metrics)
          points.set(
            metric.descriptor.name,
            metric.dataPoints.map((point) => ({
              attributes: point.attributes,
              value: point.value,
            })),
          );

    const settled = points.get('avero.tasks.settled') ?? [];
    expect(settled.map((point) => [point.attributes.status, point.value]).sort()).toEqual([
      ['failed', 1],
      ['finished', 1],
    ]);
    expect(points.get('avero.outbox.published')?.[0]?.value).toBe(3);
    expect(
      (points.get('avero.tasks.recovered') ?? []).map((point) => [
        point.attributes.outcome,
        point.value,
      ]),
    ).toEqual([
      ['requeued', 2],
      ['failed', 1],
    ]);
    expect(points.get('avero.guard.denied')?.[0]?.value).toBe(4);
    expect(points.has('avero.task.duration')).toBe(true);
  });
});

describe('log correlation', () => {
  it('adds the trace and span ids to a log line written inside a span', async () => {
    const { spans } = start();
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await withSpan('task.run', {}, async () => {
      writeLog('info', 'inside');
    });
    writeLog('info', 'outside');
    const [inside, outside] = stdout.mock.calls.map((call) => JSON.parse(String(call[0])));
    const span = spans.getFinishedSpans()[0];
    expect(inside.traceId).toBe(span?.spanContext().traceId);
    expect(inside.spanId).toBe(span?.spanContext().spanId);
    expect(outside.traceId).toBeUndefined();
  });
});
