import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isRunId, listRuns, readDecision, readRun, readVerdict } from '@avero/run-store';
import { renderIndexPage } from './index-page.ts';
import { pageCsp, renderRunPage, staticPageCsp } from './page.ts';

export type ServeOptions = {
  /** The folder of run records, for example `.avero/runs`. */
  dir: string;
  /** 0 picks a free port. */
  port: number;
  /** Defaults to 127.0.0.1, so only this machine can reach it. */
  host?: string;
};

export type RunServer = {
  /** The address to open, for example `http://127.0.0.1:4173`. */
  url: string;
  close(): Promise<void>;
};

const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost']);

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function send(
  response: ServerResponse,
  request: IncomingMessage,
  status: number,
  body: string,
  type: string,
  csp: string,
  extra: Record<string, string> = {},
) {
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Content-Security-Policy': `${csp}; frame-ancestors 'none'`,
    ...securityHeaders,
    ...extra,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

const text = (
  response: ServerResponse,
  request: IncomingMessage,
  status: number,
  message: string,
  extra?: Record<string, string>,
) =>
  send(
    response,
    request,
    status,
    `${message}\n`,
    'text/plain; charset=utf-8',
    "default-src 'none'",
    extra,
  );

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/**
 * Serves a folder of run records, read-only, for the person who recorded them. It answers three
 * kinds of request: `/` (the list), `/runs/<id>` (one replay) and `/healthz`. It binds to
 * 127.0.0.1 unless told otherwise, never writes, refuses any method but GET and HEAD, and when it
 * is on a loopback address it also refuses a `Host` header that is not that address, so a web
 * page on another site cannot read your runs by pointing its own name at your machine.
 */
export async function serveRuns(options: ServeOptions): Promise<RunServer> {
  const host = options.host ?? '127.0.0.1';

  async function handle(request: IncomingMessage, response: ServerResponse) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      text(response, request, 405, 'This viewer is read-only.', { Allow: 'GET, HEAD' });
      return;
    }
    if (loopbackHosts.has(host)) {
      const { port } = server.address() as AddressInfo;
      const allowed = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
      if (!allowed.includes((request.headers.host ?? '').toLowerCase())) {
        text(response, request, 403, 'That host name is not allowed.');
        return;
      }
    }

    let pathname: string;
    try {
      pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    } catch {
      text(response, request, 400, 'That is not a valid address.');
      return;
    }

    if (pathname === '/healthz') {
      send(
        response,
        request,
        200,
        '{"ok":true}\n',
        'application/json; charset=utf-8',
        staticPageCsp,
      );
      return;
    }

    if (pathname === '/') {
      const { runs, problems } = await listRuns(options.dir);
      send(
        response,
        request,
        200,
        renderIndexPage(runs, { problems }),
        'text/html; charset=utf-8',
        staticPageCsp,
      );
      return;
    }

    if (pathname === '/runs' || pathname === '/runs/') {
      text(response, request, 302, 'See /', { Location: '/' });
      return;
    }

    const match = /^\/runs\/([^/]+)\/?$/.exec(pathname);
    if (match?.[1] !== undefined) {
      let id: string;
      try {
        id = decodeURIComponent(match[1]);
      } catch {
        text(response, request, 400, 'That is not a valid run id.');
        return;
      }
      if (!isRunId(id)) {
        text(response, request, 400, 'That is not a valid run id.');
        return;
      }
      let record;
      try {
        record = await readRun(options.dir, id);
      } catch (error) {
        if (errorCode(error) === 'ENOENT') {
          text(response, request, 404, 'No such run.');
        } else {
          const reason = error instanceof Error ? error.message : 'unreadable';
          text(response, request, 500, `That run record could not be read: ${reason}`);
        }
        return;
      }
      // A damaged verdict or decision file should not hide the run itself.
      const [verdict, decision] = await Promise.all([
        readVerdict(options.dir, id).catch(() => undefined),
        readDecision(options.dir, id).catch(() => undefined),
      ]);
      send(
        response,
        request,
        200,
        renderRunPage(record, { verdict, decision, backHref: '/' }),
        'text/html; charset=utf-8',
        pageCsp,
      );
      return;
    }

    text(response, request, 404, 'Not found.');
  }

  const server = createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent)
        text(response, request, 500, 'Something went wrong reading the runs.');
      else response.destroy();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const { port } = server.address() as AddressInfo;
  const shownHost = host.includes(':') ? `[${host}]` : host;

  return {
    url: `http://${shownHost}:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
