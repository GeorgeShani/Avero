import 'server-only';
import type { LoadedRun, RunListing } from '@avero/contracts';
import { runSource } from './run-source';

export type { LoadedRun };

export async function loadRuns(): Promise<RunListing & { dir: string }> {
  const source = runSource();
  return { dir: source.label, ...(await source.listRuns()) };
}

/** One run with its verdict and decision, or undefined when there is no such run. A record that
 * cannot be read still throws, so a broken record is not mistaken for a missing one. */
export function loadRun(runId: string): Promise<LoadedRun | undefined> {
  return runSource().getRun(runId);
}

/** Whether this viewer may record decisions. Off on a viewer that is shared. */
export function viewerReadOnly(): boolean {
  return process.env.AVERO_READ_ONLY === '1';
}
