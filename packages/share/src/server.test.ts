import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveRuns, type RunServer } from './server.ts';
import { sampleDecision, sampleRecord, sampleVerdict } from './test-fixtures.ts';

let dir: string;
let server: RunServer;

function jsonl(record: ReturnType<typeof sampleRecord>): string {
  return `${[record.started, ...record.events].map((event) => JSON.stringify(event)).join('\n')}\n`;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-serve-'));
  await writeFile(join(dir, 'run-sample.jsonl'), jsonl(sampleRecord()));
  await writeFile(join(dir, 'run-sample.verdict.json'), JSON.stringify(sampleVerdict()));
  await writeFile(join(dir, 'run-sample.decision.json'), JSON.stringify(sampleDecision()));
  await writeFile(
    join(dir, 'run-other.jsonl'),
    jsonl(sampleRecord({ runId: 'run-other', task: 'Second task' })),
  );
  await writeFile(join(dir, 'run-other.verdict.json'), '{ not json');
  await writeFile(join(dir, 'broken.jsonl'), 'not json');
  server = await serveRuns({ dir, port: 0 });
});

afterAll(async () => {
  await server.close();
  await rm(dir, { recursive: true, force: true });
});

describe('serveRuns', () => {
  it('binds to loopback and reports the address', () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('answers /healthz', async () => {
    const response = await fetch(`${server.url}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('lists the runs at /, and reports a file it cannot read', async () => {
    const response = await fetch(`${server.url}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('href="runs/run-sample"');
    // run-store reports a run with a damaged verdict file as a problem instead of hiding it.
    expect(html).toContain('broken.jsonl');
    expect(html).toContain('run-other.jsonl');
  });

  it('serves one run as a replay page with its verdict and decision', async () => {
    const response = await fetch(`${server.url}/runs/run-sample`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="avero-data"');
    expect(html).toContain('Retry with exponential backoff');
    expect(html).toContain('"decision":"approved"');
    expect(html).toContain('href="/"');
    expect((await fetch(`${server.url}/runs/run-sample/`)).status).toBe(200);
  });

  it('still shows a run when its verdict file is damaged', async () => {
    const response = await fetch(`${server.url}/runs/run-other`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Second task');
  });

  it('sets the security headers on every kind of answer', async () => {
    for (const path of ['/', '/runs/run-sample', '/healthz', '/missing', '/runs/..%2Fsecrets']) {
      const response = await fetch(`${server.url}${path}`);
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      await response.arrayBuffer();
    }
    const page = await fetch(`${server.url}/runs/run-sample`);
    expect(page.headers.get('content-security-policy')).toContain("script-src 'unsafe-inline'");
    const index = await fetch(`${server.url}/`);
    expect(index.headers.get('content-security-policy')).not.toContain('script-src');
    await Promise.all([page.arrayBuffer(), index.arrayBuffer()]);
  });

  it('answers 404 for an unknown run or path, and 400 for an id that is not valid', async () => {
    expect((await fetch(`${server.url}/runs/run-nope`)).status).toBe(404);
    expect((await fetch(`${server.url}/nothing`)).status).toBe(404);
    expect((await fetch(`${server.url}/runs/..%2Fsecrets`)).status).toBe(400);
    expect((await fetch(`${server.url}/runs/a%00b`)).status).toBe(400);
    expect((await fetch(`${server.url}/runs/run-sample.jsonl`)).status).toBe(400);
    expect((await fetch(`${server.url}/runs/%E0%A4%A`)).status).toBe(400);
    expect((await fetch(`${server.url}/runs/${'a'.repeat(129)}`)).status).toBe(400);
  });

  it('cannot be asked to read outside the folder', async () => {
    // Raw paths with dot segments, which fetch would normalise away.
    const statuses = await Promise.all(
      ['/runs/../package.json', '/runs/..\\x', '/runs/%2e%2e%2f%2e%2e%2fetc'].map(
        (path) =>
          new Promise<number>((resolve, reject) => {
            const url = new URL(server.url);
            httpRequest({ host: url.hostname, port: url.port, path, method: 'GET' }, (response) => {
              response.resume();
              resolve(response.statusCode ?? 0);
            })
              .on('error', reject)
              .end();
          }),
      ),
    );
    for (const status of statuses) expect([400, 404]).toContain(status);
  });

  it('is read-only: only GET and HEAD are allowed', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await fetch(`${server.url}/runs/run-sample`, {
        method,
        body: method === 'DELETE' ? undefined : 'x',
      });
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('GET, HEAD');
      await response.arrayBuffer();
    }
    const head = await fetch(`${server.url}/`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('refuses a Host header that is not the loopback address, against DNS rebinding', async () => {
    const url = new URL(server.url);
    const status = await new Promise<number>((resolve, reject) => {
      httpRequest(
        {
          host: url.hostname,
          port: url.port,
          path: '/runs/run-sample',
          headers: { Host: 'evil.example:80' },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        },
      )
        .on('error', reject)
        .end();
    });
    expect(status).toBe(403);
  });

  it('serves an empty folder and a folder that does not exist', async () => {
    const missing = await serveRuns({ dir: join(dir, 'nowhere'), port: 0 });
    try {
      const response = await fetch(`${missing.url}/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('No runs here yet');
    } finally {
      await missing.close();
    }
  });

  it('closes cleanly', async () => {
    const extra = await serveRuns({ dir, port: 0 });
    await fetch(`${extra.url}/healthz`).then((response) => response.arrayBuffer());
    await extra.close();
    await expect(fetch(`${extra.url}/healthz`)).rejects.toThrow();
  });
});
