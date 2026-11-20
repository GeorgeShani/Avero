import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { runStdioServer } from '@avero/mcp';
import { isRunId, readRun, runsDir } from '@avero/run-store';
import { exportRun, serveRuns, toAgentTrace } from '@avero/share';

export const shareCommands = ['export', 'trace', 'serve', 'mcp'] as const;

const options = {
  out: { type: 'string' },
  revision: { type: 'string' },
  provider: { type: 'string' },
  port: { type: 'string' },
  host: { type: 'string' },
  cwd: { type: 'string' },
  'runs-dir': { type: 'string' },
} as const;

const loopback = new Set(['127.0.0.1', '::1', 'localhost']);

function runsFolder(values: { cwd?: string | undefined; 'runs-dir'?: string | undefined }): string {
  return values['runs-dir'] ? resolve(values['runs-dir']) : runsDir(resolve(values.cwd ?? '.'));
}

function noSuchRun(error: unknown, runId: string): string | undefined {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return `No such run: ${runId}`;
  return undefined;
}

async function exportCommand(runId: string | undefined, folder: string, out?: string) {
  if (!runId) {
    console.error('Which run? avero export <run-id> [--out <file>]');
    return 2;
  }
  if (!isRunId(runId)) {
    console.error('That is not a valid run id.');
    return 1;
  }
  try {
    const result = await exportRun({
      dir: folder,
      runId,
      outFile: resolve(out ?? `${runId}.html`),
      secrets: [process.env.CURSOR_API_KEY].filter((secret): secret is string => Boolean(secret)),
    });
    console.log(
      `Wrote ${result.outFile} (${Math.round(result.html.length / 1024)} KB, one file, no network needed).`,
    );
    if (result.redactions > 0)
      console.log(`Redacted ${result.redactions} secret-looking value(s).`);
    console.log(
      'Read the file before you share it: redaction catches known secret formats, not everything. The page contains the task, the commands the agent ran and the diff.',
    );
    return 0;
  } catch (error) {
    console.error(
      noSuchRun(error, runId) ?? (error instanceof Error ? error.message : 'Export failed.'),
    );
    return 1;
  }
}

async function traceCommand(
  runId: string | undefined,
  folder: string,
  values: {
    out?: string | undefined;
    revision?: string | undefined;
    provider?: string | undefined;
  },
) {
  if (!runId) {
    console.error('Which run? avero trace <run-id> [--out <file>] [--revision <sha>]');
    return 2;
  }
  if (!isRunId(runId)) {
    console.error('That is not a valid run id.');
    return 1;
  }
  try {
    const trace = toAgentTrace(await readRun(folder, runId), {
      ...(values.revision ? { revision: values.revision } : {}),
      ...(values.provider ? { provider: values.provider } : {}),
    });
    const json = `${JSON.stringify(trace, null, 2)}\n`;
    if (values.out) {
      await writeFile(resolve(values.out), json);
      console.log(`Wrote ${resolve(values.out)}`);
    } else process.stdout.write(json);
    if (!values.revision) {
      console.error(
        'Note: vcs.revision is the commit the agent started from. Pass --revision <sha> with the commit that contains its changes.',
      );
    }
    return 0;
  } catch (error) {
    console.error(
      noSuchRun(error, runId) ?? (error instanceof Error ? error.message : 'Trace failed.'),
    );
    return 1;
  }
}

async function serveCommand(
  folder: string,
  portText: string | undefined,
  host: string | undefined,
) {
  const port = portText === undefined ? 4173 : Number(portText);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    console.error('--port needs a whole number from 0 to 65535.');
    return 2;
  }
  if (host && !loopback.has(host)) {
    console.error(
      `Warning: ${host} is not a loopback address. Anyone who can reach it can read your runs, which include the diffs and commands.`,
    );
  }
  const server = await serveRuns({ dir: folder, port, ...(host ? { host } : {}) });
  console.log(`Avero viewer: ${server.url}\nReading ${folder}. Read-only. Press Ctrl+C to stop.`);
  await new Promise<void>((done) => {
    process.once('SIGINT', () => done());
    process.once('SIGTERM', () => done());
  });
  await server.close();
  return 0;
}

/** `avero export | trace | serve | mcp`. */
export async function shareCli(command: string, argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Bad arguments.');
    return 2;
  }
  const { values, positionals } = parsed;
  const folder = runsFolder(values);
  switch (command) {
    case 'export':
      return exportCommand(positionals[0], folder, values.out);
    case 'trace':
      return traceCommand(positionals[0], folder, values);
    case 'serve':
      return serveCommand(folder, values.port, values.host);
    case 'mcp':
      // stdout carries the protocol: nothing else may be printed to it.
      await runStdioServer({ dir: folder });
      return 0;
    default:
      console.error(`Unknown command "${command}".`);
      return 2;
  }
}
