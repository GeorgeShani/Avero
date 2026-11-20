#!/usr/bin/env node
import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { runsDir } from '@avero/run-store';
import { runStdioServer } from './server.ts';

const help = `avero-mcp: an MCP server (stdio) that lets an agent read Avero run records, read-only.

  avero-mcp [--runs-dir <dir>]

--runs-dir defaults to AVERO_RUNS_DIR, or .avero/runs in the current folder.
Tools: list_runs, get_run, get_run_events, get_verdict, get_changes, search_runs.`;

let args;
try {
  args = parseArgs({
    options: { 'runs-dir': { type: 'string' }, help: { type: 'boolean', short: 'h' } },
    allowPositionals: false,
  });
} catch (error) {
  // stdout carries the protocol, so every message goes to stderr.
  console.error(error instanceof Error ? error.message : 'Bad arguments.');
  console.error(help);
  process.exit(2);
}

if (args.values.help) {
  console.error(help);
  process.exit(0);
}

const dir = args.values['runs-dir'] ? resolve(args.values['runs-dir']) : runsDir();
console.error(`avero-mcp reading ${dir}`);
runStdioServer({ dir }).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'avero-mcp could not start.');
  process.exit(1);
});
