import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  decisionSchema,
  parseRunRecord,
  summarizeRun,
  verdictSchema,
  type Decision,
  type RunListItem,
  type RunRecord,
  type Verdict,
} from '@avero/contracts';

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

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** The reviewer's verdict sits beside the run record, never inside it, so a record never changes. */
export async function writeVerdict(dir: string, verdict: Verdict): Promise<string> {
  fileFor(dir, verdict.runId);
  const path = join(dir, `${verdict.runId}.verdict.json`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(verdictSchema.parse(verdict), null, 2)}\n`, 'utf8');
  return path;
}

export async function readVerdict(dir: string, runId: string): Promise<Verdict | undefined> {
  fileFor(dir, runId);
  const text = await readOptional(join(dir, `${runId}.verdict.json`));
  return text === undefined ? undefined : verdictSchema.parse(JSON.parse(text));
}

/** A person's decision on a run. A new decision replaces the old one. */
export async function writeDecision(dir: string, decision: Decision): Promise<string> {
  fileFor(dir, decision.runId);
  const path = join(dir, `${decision.runId}.decision.json`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(decisionSchema.parse(decision), null, 2)}\n`, 'utf8');
  return path;
}

export async function readDecision(dir: string, runId: string): Promise<Decision | undefined> {
  fileFor(dir, runId);
  const text = await readOptional(join(dir, `${runId}.decision.json`));
  return text === undefined ? undefined : decisionSchema.parse(JSON.parse(text));
}

export type { RunListItem };

export type RunListing = {
  runs: RunListItem[];
  /** Files that could not be read as run records, with the reason. */
  problems: { file: string; message: string }[];
};

/** Every run in the folder, newest first. A broken file is reported, not hidden. */
export async function listRuns(dir: string): Promise<RunListing> {
  const names = await readdir(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [] as string[];
    throw error;
  });
  const runs: RunListItem[] = [];
  const problems: RunListing['problems'] = [];
  for (const name of names.filter((entry) => entry.endsWith('.jsonl'))) {
    try {
      const summary = summarizeRun(parseRunRecord(await readFile(join(dir, name), 'utf8')));
      const [verdict, decision] = await Promise.all([
        readVerdict(dir, summary.runId),
        readDecision(dir, summary.runId),
      ]);
      runs.push({
        ...summary,
        review: {
          ...(verdict
            ? {
                risk: verdict.risk.tier,
                failedChecks: verdict.checks.filter((check) => check.verdict === 'fail').length,
              }
            : {}),
          ...(decision ? { decision: decision.decision } : {}),
        },
      });
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
