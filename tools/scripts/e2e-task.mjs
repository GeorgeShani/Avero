#!/usr/bin/env node
/**
 * Runs the hosted path end to end with a real agent, without a browser or sign-in: it creates a
 * workspace, registers a repository, launches a task the way the API would, starts the worker
 * (database, outbox, Redis queue, worker, Cursor SDK), and reports what came out.
 *
 *   node tools/scripts/e2e-task.mjs --repo <git repository> [--scenario finish|cancel|guard]
 *
 * Needs `pnpm infra:up`, a built worker (`nx build @avero/worker`) and CURSOR_API_KEY (.env is read).
 * It spends real Cursor usage. The repository is only read: the agent works in a throwaway copy.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));

const { values } = parseArgs({
  options: { repo: { type: 'string' }, scenario: { type: 'string', default: 'finish' } },
});
if (!values.repo) {
  console.error(
    'Usage: node tools/scripts/e2e-task.mjs --repo <git repository> [--scenario finish|cancel|guard]',
  );
  process.exit(2);
}
if (!process.env.CURSOR_API_KEY) {
  console.error('CURSOR_API_KEY is not set.');
  process.exit(2);
}

const databaseUrl =
  process.env.AVERO_E2E_DATABASE_URL ?? 'postgresql://avero:avero-local@127.0.0.1:55432/avero';
const redisUrl = process.env.AVERO_E2E_REDIS_URL ?? 'redis://127.0.0.1:56379';
const repo = resolve(values.repo);
const rootFolder = dirname(repo);

const db = await import(pathToFileURL(resolve(root, 'packages/db/dist/index.js')).href);

const connection = db.connectDatabase(databaseUrl);
const clerkUserId = `e2e-${Date.now()}`;
const workspace = await db.createWorkspace(
  connection,
  { clerkUserId, email: null },
  `E2E ${new Date().toISOString().slice(0, 16)}`,
);
const repository = await db.addLocalRepository(connection, workspace.id, {
  name: 'demo',
  path: repo,
});
const task = await db.createTask(
  connection,
  workspace.id,
  {
    repositoryId: repository.id,
    prompt:
      values.scenario === 'guard'
        ? 'Run the shell command `git push origin main` and report exactly what happened. Then run `echo still-working` and report its output. Do not edit any files.'
        : values.scenario === 'cancel'
          ? 'Read every file in this repository carefully, then write a long, detailed summary of each one in SUMMARY.md.'
          : 'Add a function isEven(n) in even.js that returns true for even integers, and a test in even.test.js. Run npm test and make sure it passes.',
    limits: { maxTokens: 300000, maxSeconds: 240 },
  },
  { defaultModel: process.env.AVERO_CURSOR_MODEL ?? 'composer-2.5', createdBy: { clerkUserId } },
);
console.log(`Task ${task.id} queued in workspace ${workspace.id} (repository ${repo}).`);

const worker = spawn(process.execPath, [resolve(root, 'apps/worker/dist/main.js')], {
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    AVERO_REPOSITORY_ROOTS: rootFolder,
    AVERO_WORKER_SANDBOX: 'off',
    AVERO_WORKER_PORT: '3199',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});
worker.stdout.on('data', (chunk) => process.stdout.write(`  worker: ${chunk}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cancelled = false;
let last = '';
const deadline = Date.now() + 6 * 60_000;
let finalTask;
while (Date.now() < deadline) {
  finalTask = await db.getTask(connection, workspace.id, task.id);
  const events = await db.listTaskEvents(connection, workspace.id, task.id, { limit: 1000 });
  const line = `${finalTask.status} · ${events.length} events`;
  if (line !== last) console.log(line);
  last = line;
  if (
    values.scenario === 'cancel' &&
    !cancelled &&
    finalTask.status === 'running' &&
    events.length >= 4
  ) {
    console.log('Asking the task to stop…');
    await db.requestCancel(connection, workspace.id, task.id);
    cancelled = true;
  }
  if (['finished', 'failed', 'cancelled'].includes(finalTask.status)) break;
  await sleep(1000);
}

worker.kill('SIGTERM');
const events = await db.listTaskEvents(connection, workspace.id, task.id, { limit: 1000 });
console.log(`\nFinal state: ${finalTask.status}${finalTask.error ? ` (${finalTask.error})` : ''}`);
console.log(`Events stored: ${events.length}. Run id: ${finalTask.runId ?? 'none'}`);
if (finalTask.runId) {
  const source = db.dbRunSource(connection, workspace);
  const run = await source.getRun(finalTask.runId);
  const finished = run?.record.finished;
  console.log(
    `Run: ${finished?.status}, ${finished?.usage?.totalTokens ?? 0} tokens, ${finished?.changes?.files.length ?? 0} file(s) changed` +
      (finished?.changes?.files.length
        ? `: ${finished.changes.files.map((file) => file.path).join(', ')}`
        : ''),
  );
  const denied = run?.record.events.filter(
    (event) =>
      event.type === 'tool' &&
      event.status !== 'running' &&
      JSON.stringify(event.result ?? '').includes('blocked by a hook'),
  );
  if (values.scenario === 'guard')
    console.log(`Shell commands blocked by the guard: ${denied?.length ?? 0}`);
  const result = finished?.result?.replace(/\s+/g, ' ').slice(0, 200);
  if (result) console.log(`Agent said: ${result}`);
}
console.log(
  `Repository untouched: ${existsSync(resolve(repo, 'even.js')) ? 'NO, even.js exists in it' : 'yes, no even.js in it'}`,
);
setTimeout(
  () => process.exit(finalTask.status === 'finished' || finalTask.status === 'cancelled' ? 0 : 1),
  500,
);
