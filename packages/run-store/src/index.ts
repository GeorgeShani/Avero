import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRunRecord, summarizeRun, type RunRecord, type RunSummary } from '@avero/contracts';

const runIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

/** Where run records live: AVERO_RUNS_DIR, or `.avero/runs` under the given folder. */
export function runsDir(cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.AVERO_RUNS_DIR?.trim();
  return configured ? configured : join(cwd, '.avero', 'runs');
}

export function isRunId(value: string): boolean {
  return runIdPattern.test(value);
}

function fileFor(dir: string, runId: string): string {
  if (!isRunId(runId)) throw new Error('That is not a valid run id.');
  return join(dir, `${runId}.jsonl`);
}

/** Appends record lines to `<dir>/<runId>.jsonl`, creating the folder on first use. */
export async function createRunWriter(dir: string, runId: string) {
  const path = fileFor(dir, runId);
  await mkdir(dir, { recursive: true });
  return {
    path,
    write: (line: string) => appendFile(path, `${line}\n`, 'utf8'),
  };
}

export async function readRun(dir: string, runId: string): Promise<RunRecord> {
  return parseRunRecord(await readFile(fileFor(dir, runId), 'utf8'));
}

export type RunListing = {
  runs: RunSummary[];
  /** Files that could not be read as run records, with the reason. */
  problems: { file: string; message: string }[];
};

/** Every run in the folder, newest first. A broken file is reported, not hidden. */
export async function listRuns(dir: string): Promise<RunListing> {
  const names = await readdir(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [] as string[];
    throw error;
  });
  const runs: RunSummary[] = [];
  const problems: RunListing['problems'] = [];
  for (const name of names.filter((entry) => entry.endsWith('.jsonl'))) {
    try {
      runs.push(summarizeRun(parseRunRecord(await readFile(join(dir, name), 'utf8'))));
    } catch (error) {
      problems.push({
        file: name,
        message: error instanceof Error ? error.message : 'Unreadable.',
      });
    }
  }
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return { runs, problems };
}
