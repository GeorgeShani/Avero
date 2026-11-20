#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { recordRun } from '@avero/coding-engine';
import { describeToolCall, summarizeRun, type RunEvent } from '@avero/contracts';
import { createRunWriter, listRuns, readRun, runsDir } from '@avero/run-store';
import { describeStatus, formatCost, formatDuration } from './format.ts';

const usage = `Avero: record, replay and review coding-agent runs.

  avero run "<task>" [--cwd <dir>] [--model <id>] [--runs-dir <dir>] [--no-sandbox]
  avero list [--runs-dir <dir>]
  avero show <run-id> [--runs-dir <dir>]
  avero serve [--port <n>] [--runs-dir <dir>]   (from this repository: pnpm avero serve)

\`run\` lets a Cursor agent edit the folder you point it at, then saves a record of everything
it did to <dir>/.avero/runs. It needs CURSOR_API_KEY (a .env file in this folder is read).`;

if (existsSync('.env')) process.loadEnvFile('.env');

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    cwd: { type: 'string' },
    model: { type: 'string' },
    'runs-dir': { type: 'string' },
    'no-sandbox': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

const [command, ...rest] = positionals;
const workDir = resolve(values.cwd ?? process.cwd());
const dir = values['runs-dir'] ? resolve(values['runs-dir']) : runsDir(workDir);

function progress(event: RunEvent, starts: Map<string, number>) {
  if (event.type === 'tool') {
    if (event.status === 'running') {
      starts.set(event.callId, event.t);
      return;
    }
    const took = event.t - (starts.get(event.callId) ?? event.t);
    const mark = event.status === 'completed' ? '✓' : '✕';
    console.log(`  ${mark} ${describeToolCall(event.name, event.args)} (${formatDuration(took)})`);
  } else if (event.type === 'assistant') {
    console.log(`  › ${event.text.replace(/\s+/g, ' ').slice(0, 110)}`);
  } else if (event.type === 'note') {
    console.log(`  # ${event.text}`);
  }
}

async function run(task: string | undefined): Promise<number> {
  if (!task?.trim()) {
    console.error('Give the agent a task: avero run "fix the flaky retry test"');
    return 2;
  }
  if (!process.env.CURSOR_API_KEY) {
    console.error('CURSOR_API_KEY is not set. Put it in your environment or a .env file.');
    return 2;
  }
  const model = values.model ?? process.env.AVERO_CURSOR_MODEL?.trim() ?? 'composer-2.5';
  const runId = `run-${Date.now().toString(36)}`;
  const writer = await createRunWriter(dir, runId);
  const starts = new Map<string, number>();
  console.log(`Recording ${runId} in ${workDir}\n  model ${model}\n`);

  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());

  const { status } = await recordRun({
    task,
    cwd: workDir,
    model,
    runId,
    sandbox: !values['no-sandbox'],
    signal: abort.signal,
    sink: writer.write,
    onEvent: (event) => progress(event, starts),
  });
  const record = await readRun(dir, runId);
  console.log(`\n${describeStatus(summarizeRun(record))}\nSaved ${writer.path}`);
  const error = record.finished?.error;
  if (error) console.error(`\n${error}`);
  if (error && /sandbox/i.test(error) && !values['no-sandbox']) {
    console.error(
      'The Cursor sandbox is not available here. To run the agent without it, pass --no-sandbox.\n' +
        'Without the sandbox the agent can run any command on this machine, so use a folder you can afford to lose.',
    );
  }
  return status === 'FINISHED' ? 0 : 1;
}

async function list(): Promise<number> {
  const { runs, problems } = await listRuns(dir);
  if (runs.length === 0) console.log(`No runs in ${dir}.`);
  for (const item of runs) {
    console.log(
      `${item.runId}  ${describeStatus(item)}\n  ${item.task.replace(/\s+/g, ' ').slice(0, 100)}`,
    );
  }
  for (const problem of problems) {
    console.error(`Could not read ${problem.file}: ${problem.message}`);
  }
  return problems.length > 0 ? 1 : 0;
}

async function show(runId: string | undefined): Promise<number> {
  if (!runId) {
    console.error('Which run? avero show <run-id>');
    return 2;
  }
  const record = await readRun(dir, runId);
  const summary = summarizeRun(record);
  console.log(`${record.started.runId} · ${record.started.model} · ${record.started.startedAt}`);
  console.log(`Task: ${record.started.task}\n${describeStatus(summary)}\n`);
  const starts = new Map<string, number>();
  for (const event of record.events) progress(event, starts);
  const changes = record.finished?.changes;
  if (changes) {
    console.log(
      `\nChanged ${changes.files.length} files (+${changes.additions} -${changes.deletions}):`,
    );
    for (const file of changes.files) console.log(`  ${file.status.padEnd(9)} ${file.path}`);
  }
  if (record.finished?.error) console.log(`\nError: ${record.finished.error}`);
  if (record.finished?.cost) {
    console.log(`\nBilled ${formatCost(record.finished.cost.chargedCents)}`);
  }
  return 0;
}

try {
  if (values.help || !command) {
    console.log(usage);
    process.exitCode = command || values.help ? 0 : 2;
  } else if (command === 'run') process.exitCode = await run(rest.join(' '));
  else if (command === 'list') process.exitCode = await list();
  else if (command === 'show') process.exitCode = await show(rest[0]);
  else if (command === 'serve') {
    console.error('The viewer starts through the repository script: pnpm avero serve');
    process.exitCode = 2;
  } else {
    console.error(`Unknown command "${command}".\n\n${usage}`);
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The command failed.');
  process.exitCode = 1;
}
