import type { Decision, RunListItem, Verdict } from '../agents/verdict.ts';
import type { RunRecord } from '../events/run-record.ts';
import type { BenchResult, BenchSuite } from '../tasks/bench.ts';
import type { Hillclimb } from '../tasks/hillclimb.ts';

export type RunListing = {
  runs: RunListItem[];
  /** Records that could not be read, with the reason. A broken record is reported, not hidden. */
  problems: { file: string; message: string }[];
};

/** One run with the reviewer's verdict and the person's decision, when they exist. */
export type LoadedRun = { record: RunRecord; verdict?: Verdict; decision?: Decision };

export type LoadedSuite = {
  suite: BenchSuite;
  results: BenchResult[];
  hillclimbs: Hillclimb[];
};

/**
 * Where the console reads recorded runs and bench results from. The local console reads files
 * (`fileRunSource` in `@avero/run-store`); the hosted dashboard reads the database. Pages talk to
 * this interface only, so the same pages serve both.
 *
 * Methods that look something up answer `undefined` when it does not exist and throw when it
 * exists but cannot be read, so a damaged record is never mistaken for a missing one.
 */
export type RunSource = {
  /** Where the data comes from, for display: a folder path, or the workspace name. */
  readonly label: string;
  listRuns(): Promise<RunListing>;
  getRun(runId: string): Promise<LoadedRun | undefined>;
  /** Saves a person's decision. The run must exist. */
  saveDecision(decision: Decision): Promise<void>;
  listSuites(): Promise<BenchSuite[]>;
  getSuite(suiteId: string): Promise<LoadedSuite | undefined>;
  /** One bench result or one hillclimb of a suite, whichever `id` names. */
  getBenchItem(
    suiteId: string,
    id: string,
  ): Promise<{ suite: BenchSuite; result?: BenchResult; hillclimb?: Hillclimb } | undefined>;
  /** The most recent bench result across all suites. */
  latestBench(): Promise<{ suite: BenchSuite; result: BenchResult } | undefined>;
};
