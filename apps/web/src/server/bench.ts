import 'server-only';
import type { BenchResult, BenchSuite, Hillclimb } from '@avero/contracts';
import {
  benchRoot,
  listBenchResults,
  listHillclimbs,
  listSuites,
  readBenchResult,
  readHillclimb,
  readSuite,
} from '@avero/run-store';
import { resolveRunsDir } from './runs-dir';

function root(): string {
  return benchRoot(resolveRunsDir());
}

export async function loadSuites(): Promise<{ dir: string; suites: BenchSuite[] }> {
  const dir = root();
  return { dir, suites: await listSuites(dir) };
}

export type LoadedSuite = {
  suite: BenchSuite;
  results: BenchResult[];
  hillclimbs: Hillclimb[];
};

export async function loadSuite(suiteId: string): Promise<LoadedSuite | undefined> {
  const dir = root();
  const suite = await readSuite(dir, suiteId);
  if (!suite) return undefined;
  const [results, hillclimbs] = await Promise.all([
    listBenchResults(dir, suiteId),
    listHillclimbs(dir, suiteId),
  ]);
  return { suite, results, hillclimbs };
}

export async function loadResult(
  suiteId: string,
  id: string,
): Promise<{ suite: BenchSuite; result?: BenchResult; hillclimb?: Hillclimb } | undefined> {
  const dir = root();
  const suite = await readSuite(dir, suiteId);
  if (!suite) return undefined;
  const result = await readBenchResult(dir, suiteId, id);
  if (result) return { suite, result };
  const hillclimb = await readHillclimb(dir, suiteId, id);
  return hillclimb ? { suite, hillclimb } : undefined;
}

/** The most recent bench result across all suites, with its suite. */
export async function loadLatestBench(): Promise<
  { suite: BenchSuite; result: BenchResult } | undefined
> {
  const dir = root();
  const suites = await listSuites(dir);
  let latest: { suite: BenchSuite; result: BenchResult } | undefined;
  for (const suite of suites) {
    for (const result of await listBenchResults(dir, suite.id)) {
      if (!latest || result.startedAt > latest.result.startedAt) latest = { suite, result };
    }
  }
  return latest;
}
