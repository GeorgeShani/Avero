/** Illustrative example run for the marketing page. Nothing here was recorded from a real agent. */

export const runDuration = 20;

export type SpanKind = 'read' | 'tool' | 'edit' | 'test' | 'approval';

export type Span = {
  id: string;
  label: string;
  kind: SpanKind;
  start: number;
  end: number;
  detail: string;
};

export const spans: readonly Span[] = [
  {
    id: 'read',
    label: 'read repository',
    kind: 'read',
    start: 0,
    end: 3.2,
    detail: 'src/deliver.ts, src/queue.ts, 3 test files',
  },
  {
    id: 'assess',
    label: 'assess_change',
    kind: 'tool',
    start: 3.2,
    end: 4.6,
    detail: 'verdict: dependency or workflow review required',
  },
  {
    id: 'edit',
    label: 'edit 2 files',
    kind: 'edit',
    start: 4.6,
    end: 11,
    detail: 'deliver.ts +6 −1, deliver.test.ts +14',
  },
  {
    id: 'test',
    label: 'run 14 tests',
    kind: 'test',
    start: 11,
    end: 17.2,
    detail: '14 passed, 0 failed',
  },
  {
    id: 'gate',
    label: 'plan gate',
    kind: 'approval',
    start: 17.2,
    end: 20,
    detail: 'waiting for your decision',
  },
];

export function tokensAt(time: number): number {
  const t = Math.min(Math.max(time, 0), runDuration);
  return Math.round(t * 1180 + Math.sin(t * 1.7) * 90 + 90);
}

export function costAt(time: number): number {
  return (tokensAt(time) / 1_000_000) * 7.5;
}

export function clock(time: number): string {
  const whole = Math.max(0, time);
  const seconds = Math.floor(whole);
  const tenths = Math.floor((whole - seconds) * 10);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${tenths}`;
}

export const recordLines: readonly { type: string; text: string }[] = [
  { type: 'status', text: '{"t":0.0,"type":"status","status":"RUNNING"}' },
  {
    type: 'tool',
    text: '{"t":0.4,"type":"tool_call","name":"read","args":{"path":"src/deliver.ts"}}',
  },
  {
    type: 'tool',
    text: '{"t":1.8,"type":"tool_call","name":"read","args":{"path":"src/queue.ts"}}',
  },
  { type: 'think', text: '{"t":3.1,"type":"thinking","ms":1180}' },
  {
    type: 'tool',
    text: '{"t":3.2,"type":"tool_call","name":"assess_change","status":"completed"}',
  },
  {
    type: 'edit',
    text: '{"t":6.0,"type":"tool_call","name":"edit","args":{"path":"src/deliver.ts"}}',
  },
  {
    type: 'edit',
    text: '{"t":9.4,"type":"tool_call","name":"edit","args":{"path":"src/deliver.test.ts"}}',
  },
  { type: 'usage', text: '{"t":10.9,"type":"usage","totalTokens":12940}' },
  { type: 'test', text: '{"t":11.1,"type":"tool_call","name":"shell","args":{"cmd":"pnpm test"}}' },
  {
    type: 'test',
    text: '{"t":17.1,"type":"tool_call","name":"shell","status":"completed","exit":0}',
  },
  { type: 'git', text: '{"t":17.2,"type":"git","files":2,"additions":20,"deletions":1}' },
  { type: 'usage', text: '{"t":17.3,"type":"usage","totalTokens":21160}' },
  { type: 'gate', text: '{"t":17.4,"type":"approval_requested","what":"open pull request"}' },
  { type: 'status', text: '{"t":20.0,"type":"status","status":"AWAITING_APPROVAL"}' },
];

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
    state: 'Next',
  },
  {
    id: '1',
    name: 'Recorder and Scope',
    body: 'The avero run command, JSONL run records, and a replay viewer over real recordings.',
    state: 'Planned',
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
