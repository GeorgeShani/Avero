import 'server-only';
import type { BenchSuite, LoadedSuite } from '@avero/contracts';
import { runSource } from './run-source';

export type { LoadedSuite };

export async function loadSuites(): Promise<{ dir: string; suites: BenchSuite[] }> {
  const source = runSource();
  return { dir: source.label, suites: await source.listSuites() };
}

export function loadSuite(suiteId: string) {
  return runSource().getSuite(suiteId);
}

export function loadResult(suiteId: string, id: string) {
  return runSource().getBenchItem(suiteId, id);
}

/** The most recent bench result across all suites, with its suite. */
export function loadLatestBench() {
  return runSource().latestBench();
}
