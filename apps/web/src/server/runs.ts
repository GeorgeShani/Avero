import 'server-only';
import type { RunRecord } from '@avero/contracts';
import { isRunId, listRuns, readRun, type RunListing } from '@avero/run-store';
import { resolveRunsDir } from './runs-dir';

export async function loadRuns(): Promise<RunListing & { dir: string }> {
  const dir = resolveRunsDir();
  return { dir, ...(await listRuns(dir)) };
}

/** One run, or undefined when there is no such run. A file that cannot be read still throws. */
export async function loadRun(runId: string): Promise<RunRecord | undefined> {
  if (!isRunId(runId)) return undefined;
  try {
    return await readRun(resolveRunsDir(), runId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
