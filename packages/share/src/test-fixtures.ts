import {
  parseRunRecord,
  type Decision,
  type RunEvent,
  type RunRecord,
  type Verdict,
} from '@avero/contracts';

/** Helpers for the tests. They are not part of the package: the build leaves this file out. */

export const samplePatch = [
  'diff --git a/src/retry.ts b/src/retry.ts',
  'index 387f488..b5f1bc9 100644',
  '--- a/src/retry.ts',
  '+++ b/src/retry.ts',
  '@@ -1,4 +1,6 @@',
  '+const MAX = 4;',
  ' export function retry() {',
  '-  return 1;',
  '+  return 2;',
  '+  // more',
  ' }',
  'diff --git a/src/new.ts b/src/new.ts',
  'new file mode 100644',
  'index 0000000..e69de29',
  '--- /dev/null',
  '+++ b/src/new.ts',
  '@@ -0,0 +1,2 @@',
  '+export const a = 1;',
  '+export const b = 2;',
  '',
].join('\n');

export type SampleOptions = {
  task?: string;
  patch?: string;
  toolArgs?: unknown;
  result?: string;
  runId?: string;
  head?: string;
  files?: {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
    additions: number | null;
    deletions: number | null;
  }[];
};

export function sampleRecord(options: SampleOptions = {}): RunRecord {
  const runId = options.runId ?? 'run-sample';
  const events: RunEvent[] = [
    {
      type: 'run.started',
      seq: 0,
      t: 0,
      v: 1,
      runId,
      task: options.task ?? 'Retry failed webhook deliveries with exponential backoff.',
      model: 'composer-2.5',
      runtime: 'local',
      startedAt: '2026-11-20T10:00:00.000Z',
      workspace: 'webhook-retry',
      git: { head: options.head ?? 'ae2a311999b5f89a07ad00b5cb458e94f306dbca', dirtyBefore: false },
    },
    { type: 'status', seq: 1, t: 100, status: 'RUNNING' },
    { type: 'thinking', seq: 2, t: 1500, text: 'Plan the change.', durationMs: 900 },
    { type: 'assistant', seq: 3, t: 1600, text: 'Reading the code first.' },
    {
      type: 'tool',
      seq: 4,
      t: 1700,
      callId: 'c1',
      name: 'read',
      status: 'running',
      args: options.toolArgs ?? { path: 'src/retry.ts' },
    },
    {
      type: 'tool',
      seq: 5,
      t: 2100,
      callId: 'c1',
      name: 'read',
      status: 'completed',
      args: options.toolArgs ?? { path: 'src/retry.ts' },
      result: { status: 'success' },
    },
    {
      type: 'tool',
      seq: 6,
      t: 3000,
      callId: 'c2',
      name: 'edit',
      status: 'completed',
      args: { path: 'src/retry.ts' },
    },
    {
      type: 'tool',
      seq: 7,
      t: 4000,
      callId: 'c3',
      name: 'shell',
      status: 'running',
      args: { command: 'npm test' },
    },
    {
      type: 'tool',
      seq: 8,
      t: 6000,
      callId: 'c3',
      name: 'shell',
      status: 'completed',
      args: { command: 'npm test' },
      result: { status: 'success', value: { exitCode: 0, stdout: 'pass 3' } },
    },
    {
      type: 'usage',
      seq: 9,
      t: 6500,
      usage: {
        inputTokens: 900,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 1000,
      },
    },
    {
      type: 'run.finished',
      seq: 10,
      t: 7000,
      status: 'FINISHED',
      result: options.result ?? 'Done. 3 tests pass.',
      durationMs: 7000,
      usage: {
        inputTokens: 900,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 1000,
      },
      changes: {
        files: options.files ?? [
          { path: 'src/retry.ts', status: 'modified', additions: 4, deletions: 1 },
          { path: 'src/new.ts', status: 'added', additions: 2, deletions: 0 },
        ],
        additions: 6,
        deletions: 1,
        patch: options.patch ?? samplePatch,
      },
    },
  ];
  return parseRunRecord(events.map((event) => JSON.stringify(event)).join('\n'));
}

export function sampleVerdict(overrides: Partial<Verdict> = {}, runId = 'run-sample'): Verdict {
  return {
    v: 1,
    runId,
    summary: 'The change adds retries with backoff and tests pass.',
    checks: [
      {
        id: 'retry',
        claim: 'Retry with exponential backoff',
        verdict: 'pass',
        evidence: 'The loop doubles the delay.',
        files: ['src/retry.ts'],
      },
      { id: 'tests', claim: 'Run the tests', verdict: 'unclear', evidence: 'No output was shown.' },
    ],
    outOfScope: [],
    tests: { ran: true, passed: true, evidence: 'npm test exited 0.' },
    risk: { tier: 'low', reasons: ['Scoped change'] },
    reviewer: { model: 'composer-2.5', reviewedAt: '2026-11-20T10:05:00.000Z' },
    adjustments: [],
    ...overrides,
  };
}

export function sampleDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    v: 1,
    runId: 'run-sample',
    decision: 'approved',
    note: 'Looks right.',
    decidedAt: '2026-11-20T10:10:00.000Z',
    ...overrides,
  };
}

type Listener = (event?: unknown) => void;

/** A node that records what the page builds. It refuses every way of inserting markup. */
export class FakeNode {
  readonly children: FakeNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Listener[]>();
  className = '';
  hidden = false;
  value = '';
  min = '';
  max = '';
  step = '';
  scrollTop = 0;
  scrollHeight = 0;
  readonly style = {
    left: '',
    width: '',
    values: new Map<string, string>(),
    setProperty(name: string, value: string) {
      this.values.set(name, value);
    },
  };
  private own = '';

  constructor(readonly tag: string) {}

  get textContent(): string {
    return this.own + this.children.map((child) => child.textContent).join('');
  }
  set textContent(value: string) {
    this.children.length = 0;
    this.own = value;
  }
  set innerHTML(value: string) {
    throw new Error('innerHTML was used with ' + value.length + ' characters');
  }
  set outerHTML(value: string) {
    throw new Error('outerHTML was used with ' + value.length + ' characters');
  }
  insertAdjacentHTML(): never {
    throw new Error('insertAdjacentHTML was used');
  }
  append(...nodes: (FakeNode | string)[]) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const text = new FakeNode('#text');
        text.textContent = node;
        this.children.push(text);
      } else this.children.push(node);
    }
  }
  replaceChildren() {
    this.children.length = 0;
    this.own = '';
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
  /** The text a reader sees: what is under a node that is not hidden. */
  get visibleText(): string {
    if (this.hidden) return '';
    return this.own + this.children.map((child) => child.visibleText).join('');
  }
  walk(visit: (node: FakeNode) => void) {
    visit(this);
    for (const child of this.children) child.walk(visit);
  }
}

export class FakeDom {
  readonly created: FakeNode[] = [];
  readonly byId = new Map<string, FakeNode>();
  frames: ((now: number) => void)[] = [];
  reduced = false;

  constructor(dataJson: string) {
    const data = new FakeNode('script');
    data.textContent = dataJson;
    this.byId.set('avero-data', data);
  }

  node(id: string): FakeNode {
    let found = this.byId.get(id);
    if (!found) {
      found = new FakeNode('div');
      this.byId.set(id, found);
    }
    return found;
  }

  globals() {
    return {
      document: {
        getElementById: (id: string) => this.node(id),
        createElement: (tag: string) => {
          const node = new FakeNode(tag);
          this.created.push(node);
          return node;
        },
        createTextNode: (text: string) => {
          const node = new FakeNode('#text');
          node.textContent = text;
          return node;
        },
      },
      window: { matchMedia: () => ({ matches: this.reduced }) },
      requestAnimationFrame: (callback: (now: number) => void) => this.frames.push(callback),
      cancelAnimationFrame: () => {
        this.frames = [];
      },
      performance: { now: () => 0 },
    };
  }

  /** Runs the queued animation frames, one every 100 ms, until none is left or the cap is hit. */
  run(maxFrames = 100_000) {
    let now = 0;
    for (let count = 0; count < maxFrames && this.frames.length > 0; count += 1) {
      const queued = this.frames;
      this.frames = [];
      now += 100;
      for (const frame of queued) frame(now);
    }
  }

  everything(): FakeNode[] {
    const all: FakeNode[] = [];
    for (const node of this.byId.values()) node.walk((inner) => all.push(inner));
    return all;
  }
}
