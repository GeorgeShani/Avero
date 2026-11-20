import 'server-only';
import type { Decision, RunRecord, Verdict } from '@avero/contracts';
import {
  isRunId,
  listRuns,
  readDecision,
  readRun,
  readVerdict,
  type RunListing,
} from '@avero/run-store';
import { resolveRunsDir } from './runs-dir';

export async function loadRuns(): Promise<RunListing & { dir: string }> {
  const dir = resolveRunsDir();
  return { dir, ...(await listRuns(dir)) };
}

export type LoadedRun = { record: RunRecord; verdict?: Verdict; decision?: Decision };

/** One run with its verdict and decision, or undefined when there is no such run. A file that
 * cannot be read still throws, so a broken record is not mistaken for a missing one. */
export async function loadRun(runId: string): Promise<LoadedRun | undefined> {
  if (!isRunId(runId)) return undefined;
  const dir = resolveRunsDir();
  try {
    const [record, verdict, decision] = await Promise.all([
      readRun(dir, runId),
      readVerdict(dir, runId),
      readDecision(dir, runId),
    ]);
    return { record, ...(verdict ? { verdict } : {}), ...(decision ? { decision } : {}) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Whether this viewer may record decisions. Off on a viewer that is shared. */
export function viewerReadOnly(): boolean {
  return process.env.AVERO_READ_ONLY === '1';
}
