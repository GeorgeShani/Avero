import { createServer } from 'node:http';
import process from 'node:process';
import { readWorkerPort } from '@avero/config';
import { writeLog } from '@avero/observability';
import { healthResponse } from './health.ts';

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

function shutdown() {
  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
