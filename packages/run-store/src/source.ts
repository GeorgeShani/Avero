import type { BenchResult, BenchSuite, Decision, RunSource } from '@avero/contracts';
import {
  benchRoot,
  listBenchResults,
  listHillclimbs,
  listSuites,
  readBenchResult,
  readHillclimb,
  readSuite,
} from './bench.ts';
import { isRunId, listRuns, readDecision, readRun, readVerdict, writeDecision } from './index.ts';

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

/** The run source for the local console: records, verdicts, decisions and bench results as files. */
export function fileRunSource(runsFolder: string): RunSource {
  const bench = benchRoot(runsFolder);

  return {
    label: runsFolder,
    listRuns: () => listRuns(runsFolder),

    async getRun(runId) {
      if (!isRunId(runId)) return undefined;
      try {
        const [record, verdict, decision] = await Promise.all([
          readRun(runsFolder, runId),
          readVerdict(runsFolder, runId),
          readDecision(runsFolder, runId),
        ]);
        return { record, ...(verdict ? { verdict } : {}), ...(decision ? { decision } : {}) };
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },

    async saveDecision(decision: Decision) {
      await readRun(runsFolder, decision.runId);
      await writeDecision(runsFolder, decision);
    },

    listSuites: () => listSuites(bench),

    async getSuite(suiteId) {
      const suite = await readSuite(bench, suiteId);
      if (!suite) return undefined;
      const [results, hillclimbs] = await Promise.all([
        listBenchResults(bench, suiteId),
        listHillclimbs(bench, suiteId),
      ]);
      return { suite, results, hillclimbs };
    },

    async getBenchItem(suiteId, id) {
      const suite = await readSuite(bench, suiteId);
      if (!suite) return undefined;
      const result = await readBenchResult(bench, suiteId, id);
      if (result) return { suite, result };
      const hillclimb = await readHillclimb(bench, suiteId, id);
      return hillclimb ? { suite, hillclimb } : undefined;
    },

    async latestBench() {
      let latest: { suite: BenchSuite; result: BenchResult } | undefined;
      for (const suite of await listSuites(bench)) {
        for (const result of await listBenchResults(bench, suite.id)) {
          if (!latest || result.startedAt > latest.result.startedAt) latest = { suite, result };
        }
      }
      return latest;
    },
  };
}
