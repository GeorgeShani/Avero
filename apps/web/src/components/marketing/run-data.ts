/** Illustrative example data for the Verdict and Bench demos. Those features are not built yet,
 * so nothing here was produced by a real agent or reviewer. */

export const checks = [
  {
    id: 'c1',
    label: 'Retries a failed delivery',
    verdict: 'pass',
    note: 'deliver.ts wraps post() in a retry loop',
  },
  { id: 'c2', label: 'Stops after 4 attempts', verdict: 'pass', note: 'attempts: 4' },
  {
    id: 'c3',
    label: 'Backoff is exponential',
    verdict: 'fail',
    note: 'delay is a fixed 200 ms on every attempt',
  },
  {
    id: 'c4',
    label: 'Tests cover the retry path',
    verdict: 'pass',
    note: 'deliver.test.ts adds 3 retry cases, 14 pass',
  },
  {
    id: 'c5',
    label: 'Stays inside the task',
    verdict: 'warn',
    note: 'queue.ts was reformatted, which the task did not ask for',
  },
] as const;

export type Effort = 'low' | 'medium' | 'high' | 'max';
export type Rules = 'Baseline' | 'Tuned';

export const benchData: Record<Rules, Record<Effort, { pass: number; cost: number }>> = {
  Baseline: {
    low: { pass: 52, cost: 0.38 },
    medium: { pass: 64, cost: 0.71 },
    high: { pass: 71, cost: 1.3 },
    max: { pass: 73, cost: 2.9 },
  },
  Tuned: {
    low: { pass: 61, cost: 0.34 },
    medium: { pass: 72, cost: 0.62 },
    high: { pass: 76, cost: 1.12 },
    max: { pass: 77, cost: 2.6 },
  },
};

export const efforts: readonly Effort[] = ['low', 'medium', 'high', 'max'];

/** Dollars spent per task that ended up resolved. */
export function perResolved(rules: Rules, effort: Effort): number {
  const { pass, cost } = benchData[rules][effort];
  return cost / (pass / 100);
}

/** The effort level with the lowest cost per resolved task. */
export function cheapestEffort(rules: Rules): Effort {
  return efforts.reduce((a, b) => (perResolved(rules, a) <= perResolved(rules, b) ? a : b));
}

export const phases = [
  {
    id: '0',
    name: 'Prove the SDKs',
    body: 'Authenticate, record one real local run, and run one Agent SDK eval. Draft the run-record schema.',
    state: 'Done',
  },
  {
    id: '1',
    name: 'Recorder and Scope',
    body: 'The avero run command, JSONL run records, and a replay viewer over real recordings.',
    state: 'In progress',
  },
  {
    id: '2',
    name: 'Verdict and gates',
    body: 'An independent reviewer agent, the intent-versus-diff card, plan gates and budget caps.',
    state: 'Planned',
  },
  {
    id: '3',
    name: 'Bench and hillclimb',
    body: 'Tasks from your merged pull requests, a model-by-rules matrix, and cost per resolved task.',
    state: 'Planned',
  },
  {
    id: '4',
    name: 'Share and launch',
    body: 'One-file HTML replays, Agent Trace output, an MCP server, docs and a demo repository.',
    state: 'Planned',
  },
  {
    id: '5',
    name: 'Avero Cloud',
    body: 'Run sync, a launch board, a review queue, the GitHub App, cloud agents and Slack channels.',
    state: 'Planned',
  },
] as const;
