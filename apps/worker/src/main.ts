import { createServer } from 'node:http';
import process from 'node:process';
import { readGithubSettings, readWorkerPort, readWorkerRuntime } from '@avero/config';
import { connectDatabase } from '@avero/db';
import { startTelemetry, writeLog } from '@avero/observability';
import { Redis } from 'ioredis';
import { healthResponse } from './health.ts';
import { createGithubAccess } from './orchestration/github-access.ts';
import { createTaskWorker } from './processors/index.ts';
import { createTaskQueue } from './queues/index.ts';
import { startOutboxRelay, startRecovery } from './recovery/index.ts';

// Traces and metrics go to OTEL_EXPORTER_OTLP_ENDPOINT when it is set; otherwise this is inert.
const telemetry = startTelemetry({ serviceName: 'avero-worker', environment: process.env });

const host = '127.0.0.1';
const port = readWorkerPort(process.env);
const server = createServer((request, response) => {
  const { status, headers, body } = healthResponse(request.method, request.url);
  response.writeHead(status, {
    ...headers,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
});

server.on('error', (error: NodeJS.ErrnoException) => {
  writeLog('error', 'worker.server_error', { code: error.code ?? 'UNKNOWN', port });
  process.exitCode = 1;
});
server.listen(port, host, () => writeLog('info', 'worker.listening', { host, port }));

// Taking tasks needs the database, Redis and the folders the worker may touch. Without all of
// them the worker stays a health endpoint, so it never runs an agent anywhere it was not told to.
const runtime = readWorkerRuntime(process.env);
const stops: (() => Promise<unknown>)[] = [];

if (runtime) {
  const db = connectDatabase(runtime.databaseUrl);
  const redis = new Redis(runtime.redisUrl, { maxRetriesPerRequest: null });
  const queue = createTaskQueue(redis);
  const github = readGithubSettings(process.env);
  const worker = createTaskWorker(
    redis,
    {
      db,
      roots: runtime.repositoryRoots,
      apiKey: process.env.CURSOR_API_KEY,
      sandbox: runtime.sandbox,
      guard: runtime.guard,
      ...(github ? { github: createGithubAccess(github) } : {}),
    },
    { concurrency: runtime.concurrency },
  );
  worker.on('error', () => writeLog('error', 'worker.queue_error'));
  stops.push(startOutboxRelay(db, queue), startRecovery(db));
  stops.push(
    () => worker.close(),
    () => queue.close(),
    () => redis.quit(),
  );
  writeLog('info', 'worker.taking_tasks', { concurrency: runtime.concurrency });
} else {
  writeLog('info', 'worker.health_only');
}
if (telemetry.enabled) writeLog('info', 'worker.telemetry_on');

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close();
  // Stop taking work first, then the loops, then the connections. A task still running is left
  // as it is: its heartbeat stops, and recovery puts it back in the queue.
  void Promise.allSettled(stops.map((stop) => stop()))
    .then(() => telemetry.shutdown())
    .then(() => process.exit());
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
