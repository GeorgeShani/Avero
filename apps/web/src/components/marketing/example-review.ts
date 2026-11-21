import { benchResultSchema, verdictSchema, type BenchResult, type Verdict } from '@avero/contracts';
import { exampleReviewJson } from '../../content/example-review';

export type ReviewedRun = {
  task: string;
  status: string;
  durationMs: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  verdict: Verdict;
};

type Raw = Omit<ReviewedRun, 'verdict'> & { verdict: unknown };

function reviewed(raw: Raw): ReviewedRun {
  return { ...raw, verdict: verdictSchema.parse(raw.verdict) };
}

const raw = JSON.parse(exampleReviewJson) as {
  good: Raw;
  risky: Raw;
  bench: { tasks: { id: string; title: string }[]; result: unknown };
};

/** Real reviews of two recorded runs, and one real (small) bench result. Parsed against the
 * schemas, so a broken export fails loudly instead of rendering wrong. */
export const reviewedGood: ReviewedRun = reviewed(raw.good);
export const reviewedRisky: ReviewedRun = reviewed(raw.risky);
export const exampleBench: { tasks: { id: string; title: string }[]; result: BenchResult } = {
  tasks: raw.bench.tasks,
  result: benchResultSchema.parse(raw.bench.result),
};
