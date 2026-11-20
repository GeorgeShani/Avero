#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { recordRun, reviewRun, runReviewEval } from '@avero/coding-engine';
import { describeToolCall, summarizeRun, type RunEvent } from '@avero/contracts';
import {
  createRunWriter,
  listRuns,
  readRun,
  readVerdict,
  runsDir,
  writeDecision,
  writeVerdict,
} from '@avero/run-store';
import { describeStatus, describeVerdict, formatCost, formatDuration } from './format.ts';

const usage = `Avero: record, replay and review coding-agent runs.

  avero run "<task>" [--cwd <dir>] [--model <id>] [--runs-dir <dir>] [--no-sandbox]
      [--plan] [--approvals] [--max-tokens <n>] [--max-seconds <n>] [--verdict]
  avero list [--runs-dir <dir>]
  avero show <run-id> [--runs-dir <dir>]
  avero verdict <run-id> [--model <id>] [--repo <dir>] [--runs-dir <dir>]
  avero decide <run-id> approve|changes|reject [--note <text>] [--runs-dir <dir>]
  avero eval-reviewer [--model <id>]   (checks the reviewer on runs whose answer is known)
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
    repo: { type: 'string' },
    note: { type: 'string' },
    plan: { type: 'boolean' },
    approvals: { type: 'boolean' },
    verdict: { type: 'boolean' },
    'max-tokens': { type: 'string' },
    'max-seconds': { type: 'string' },
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
  } else if (event.type === 'gate') {
    const what = `${event.kind} ${event.outcome}`;
    const first = event.detail.split('\n')[0];
    const isPlan = event.kind === 'plan' && event.outcome === 'requested';
    const detail = isPlan ? `\n${event.detail}\n` : first ? `: ${first}` : '';
    console.log(`  ! ${what}${detail}`);
  }
}

/** Asks a yes or no question on the terminal. Anything but yes, including no input, is no. */
async function confirm(question: string): Promise<boolean> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await terminal.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    terminal.close();
  }
}

function positive(name: string, raw: string | undefined): number | undefined | null {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isFinite(value) && value > 0) return value;
  console.error(`--${name} needs a positive number.`);
  return null;
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
  const maxTokens = positive('max-tokens', values['max-tokens']);
  const maxSeconds = positive('max-seconds', values['max-seconds']);
  if (maxTokens === null || maxSeconds === null) return 2;
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
    ...(maxTokens !== undefined || maxSeconds !== undefined
      ? {
          limits: {
            ...(maxTokens !== undefined ? { maxTokens } : {}),
            ...(maxSeconds !== undefined ? { maxSeconds } : {}),
          },
        }
      : {}),
    ...(values.plan
      ? {
          plan: { approve: () => confirm('Approve this plan and let the agent make the changes?') },
        }
      : {}),
    ...(values.approvals
      ? {
          approvals: {
            approve: (request) =>
              confirm(`The agent asks to: ${request.action}\n  Why: ${request.reason}\nAllow it?`),
          },
        }
      : {}),
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
  if (values.verdict && status === 'FINISHED') {
    console.log('');
    const reviewed = await review(runId);
    if (reviewed !== 0) return reviewed;
  }
  return status === 'FINISHED' ? 0 : 1;
}

async function review(runId: string | undefined): Promise<number> {
  if (!runId) {
    console.error('Which run? avero verdict <run-id>');
    return 2;
  }
  if (!process.env.CURSOR_API_KEY) {
    console.error('CURSOR_API_KEY is not set. Put it in your environment or a .env file.');
    return 2;
  }
  const record = await readRun(dir, runId);
  if (!record.finished) {
    console.error('That run has not finished, so there is nothing to review yet.');
    return 1;
  }
  const model = values.model ?? process.env.AVERO_REVIEW_MODEL?.trim() ?? 'composer-2.5';
  const readsRepo = values.repo ? ' (it can read the repository)' : '';
  console.log(`Reviewing ${runId} with ${model}${readsRepo}…`);
  const verdict = await reviewRun({
    record,
    model,
    ...(values.repo ? { cwd: resolve(values.repo) } : {}),
  });
  const path = await writeVerdict(dir, verdict);
  console.log(`\n${describeVerdict(verdict).join('\n')}\n\nSaved ${path}`);
  console.log(
    `A model wrote this review. You decide: avero decide ${runId} approve|changes|reject`,
  );
  return 0;
}

const decisionWords = {
  approve: 'approved',
  changes: 'changes-requested',
  reject: 'rejected',
} as const;

async function decide(runId: string | undefined, word: string | undefined): Promise<number> {
  const decision =
    word && word in decisionWords ? decisionWords[word as keyof typeof decisionWords] : undefined;
  if (!runId || !decision) {
    console.error('Usage: avero decide <run-id> approve|changes|reject [--note <text>]');
    return 2;
  }
  await readRun(dir, runId);
  const note = values.note?.trim();
  const path = await writeDecision(dir, {
    v: 1,
    runId,
    decision,
    ...(note ? { note } : {}),
    decidedAt: new Date().toISOString(),
  });
  const verdict = await readVerdict(dir, runId);
  const context = verdict
    ? `reviewer's risk: ${verdict.risk.tier}`
    : 'no verdict was written for this run';
  console.log(`${runId}: ${decision} (${context})\nSaved ${path}`);
  return 0;
}

async function evalReviewer(): Promise<number> {
  if (!process.env.CURSOR_API_KEY) {
    console.error('CURSOR_API_KEY is not set. Put it in your environment or a .env file.');
    return 2;
  }
  const model = values.model ?? process.env.AVERO_REVIEW_MODEL?.trim() ?? 'composer-2.5';
  console.log(
    `Checking the reviewer (${model}) on runs whose answer is known. This uses Cursor usage.\n`,
  );
  const results = await runReviewEval({
    model,
    onResult: (result) => {
      const verdict = result.error ? 'ERROR' : result.problems.length === 0 ? 'ok' : 'WRONG';
      console.log(`${verdict.padEnd(5)} ${result.id}: ${result.describes}`);
      if (result.error) console.log(`        ${result.error}`);
      for (const problem of result.problems) console.log(`        - ${problem}`);
      if (result.verdict) {
        console.log(
          `        (risk ${result.verdict.risk.tier}, ${result.verdict.checks.length} checks)`,
        );
      }
    },
  });
  const right = results.filter((result) => !result.error && result.problems.length === 0).length;
  console.log(`\n${right} of ${results.length} cases right.`);
  return right === results.length ? 0 : 1;
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
  else if (command === 'verdict') process.exitCode = await review(rest[0]);
  else if (command === 'decide') process.exitCode = await decide(rest[0], rest[1]);
  else if (command === 'eval-reviewer') process.exitCode = await evalReviewer();
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
