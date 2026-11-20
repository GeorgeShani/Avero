import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMcpServer } from './server.ts';

const patch = [
  'diff --git a/deliver.js b/deliver.js',
  '--- a/deliver.js',
  '+++ b/deliver.js',
  '@@ -1 +1,2 @@',
  ' old',
  '+new line',
  'diff --git a/deliver.test.js b/deliver.test.js',
  '--- a/deliver.test.js',
  '+++ b/deliver.test.js',
  '@@ -1 +1,2 @@',
  ' a',
  '+b',
  '',
].join('\n');

const usage = {
  inputTokens: 90,
  outputTokens: 10,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 100,
};

function record(options: {
  runId: string;
  task: string;
  startedAt: string;
  result?: string;
  extraEvents?: number;
}) {
  const events: object[] = [
    {
      type: 'run.started',
      seq: 0,
      t: 0,
      v: 1,
      runId: options.runId,
      task: options.task,
      model: 'composer-2.5',
      runtime: 'local',
      startedAt: options.startedAt,
      workspace: 'demo',
    },
    { type: 'assistant', seq: 1, t: 10, text: 'x'.repeat(2000) },
    {
      type: 'tool',
      seq: 2,
      t: 20,
      callId: 'c1',
      name: 'shell',
      status: 'running',
      args: { command: 'npm test' },
    },
    {
      type: 'tool',
      seq: 3,
      t: 30,
      callId: 'c1',
      name: 'shell',
      status: 'completed',
      args: { command: 'npm test' },
      result: { status: 'success', value: { exitCode: 1, stdout: 'fail 1', stderr: '' } },
    },
  ];
  for (let index = 0; index < (options.extraEvents ?? 0); index += 1) {
    events.push({ type: 'note', seq: 10 + index, t: 40 + index, text: `note ${index}` });
  }
  events.push({
    type: 'run.finished',
    seq: 999,
    t: 5000,
    status: 'FINISHED',
    result: options.result ?? 'All done.',
    durationMs: 5000,
    usage,
    changes: {
      files: [
        { path: 'deliver.js', status: 'modified', additions: 1, deletions: 0 },
        { path: 'deliver.test.js', status: 'modified', additions: 1, deletions: 0 },
        { path: 'scratch.ts', status: 'untracked', additions: 3, deletions: 0 },
      ],
      additions: 5,
      deletions: 0,
      patch,
    },
  });
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
}

const verdict = {
  v: 1,
  runId: 'run-a',
  summary: 'Looks right.',
  checks: [{ id: 'c', claim: 'Adds retries', verdict: 'pass', evidence: 'The loop.' }],
  outOfScope: [],
  tests: { ran: true, passed: false, evidence: 'npm test exited 1.' },
  risk: { tier: 'medium', reasons: ['Tests failed'] },
  reviewer: { model: 'composer-2.5', reviewedAt: '2026-11-20T10:05:00.000Z' },
  adjustments: [],
};
const decision = {
  v: 1,
  runId: 'run-a',
  decision: 'changes-requested',
  note: 'Fix the test.',
  decidedAt: '2026-11-20T10:10:00.000Z',
};

let dir: string;
let client: Client;
let closeAll: () => Promise<void>;

type Reply = { isError?: boolean; content: { type: string; text?: string }[] };

async function call(name: string, args: Record<string, unknown> = {}) {
  const reply = (await client.callTool({ name, arguments: args })) as Reply;
  const text = reply.content[0]?.text ?? '';
  return {
    isError: reply.isError === true,
    text,
    json: () => JSON.parse(text),
  };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-mcp-'));
  await writeFile(
    join(dir, 'run-a.jsonl'),
    record({
      runId: 'run-a',
      task: 'Add Retries to deliver',
      startedAt: '2026-11-20T10:00:00.000Z',
      result: 'Added exponential backoff.',
      extraEvents: 300,
    }),
  );
  await writeFile(join(dir, 'run-a.verdict.json'), JSON.stringify(verdict));
  await writeFile(join(dir, 'run-a.decision.json'), JSON.stringify(decision));
  await writeFile(
    join(dir, 'run-b.jsonl'),
    record({
      runId: 'run-b',
      task: 'Fix the flaky test',
      startedAt: '2026-11-21T10:00:00.000Z',
      result: 'Replaced the sleep with a retry.',
    }),
  );
  await writeFile(join(dir, 'broken.jsonl'), 'not json');

  const server = createMcpServer({ dir });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  closeAll = async () => {
    await client.close();
    await server.close();
  };
});

afterAll(async () => {
  await closeAll();
  await rm(dir, { recursive: true, force: true });
});

describe('the tool list', () => {
  it('offers the six read-only tools, and nothing that writes', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_changes',
      'get_run',
      'get_run_events',
      'get_verdict',
      'list_runs',
      'search_runs',
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.description?.length).toBeGreaterThan(20);
    }
    const events = tools.find((tool) => tool.name === 'get_run_events');
    expect(JSON.stringify(events?.inputSchema)).toContain('"maximum":200');
  });
});

describe('list_runs', () => {
  it('lists runs newest first with risk and decision, and names unreadable files', async () => {
    const result = (await call('list_runs')).json();
    expect(result.total).toBe(2);
    expect(result.runs.map((run: { runId: string }) => run.runId)).toEqual(['run-b', 'run-a']);
    expect(result.runs[1]).toMatchObject({
      runId: 'run-a',
      status: 'FINISHED',
      risk: 'medium',
      decision: 'changes-requested',
      failedChecks: 0,
      filesChanged: 3,
      totalTokens: 100,
    });
    expect(result.runs[0]).toMatchObject({ risk: null, decision: null });
    expect(result.unreadableFiles[0]).toContain('broken.jsonl');
  });

  it('respects limit, and rejects a limit out of range', async () => {
    expect((await call('list_runs', { limit: 1 })).json().runs).toHaveLength(1);
    expect((await call('list_runs', { limit: 0 })).isError).toBe(true);
    expect((await call('list_runs', { limit: 201 })).isError).toBe(true);
  });
});

describe('get_run', () => {
  it('gives the summary, task, final result, files and commands with exit codes', async () => {
    const result = (await call('get_run', { run_id: 'run-a' })).json();
    expect(result.summary).toMatchObject({ runId: 'run-a', status: 'FINISHED', toolCalls: 1 });
    expect(result.task).toBe('Add Retries to deliver');
    expect(result.finalResult).toBe('Added exponential backoff.');
    expect(result.filesChanged.map((file: { path: string }) => file.path)).toEqual([
      'deliver.js',
      'deliver.test.js',
      'scratch.ts',
    ]);
    expect(result.commandsRun).toEqual([
      { command: 'npm test', exitCode: 1, outputTail: 'fail 1' },
    ]);
    expect(result.review).toEqual({ risk: 'medium', decision: 'changes-requested' });
  });

  it('cuts a very long final result', async () => {
    await writeFile(
      join(dir, 'run-long.jsonl'),
      record({
        runId: 'run-long',
        task: 'Long',
        startedAt: '2026-11-19T10:00:00.000Z',
        result: 'y'.repeat(9000),
      }),
    );
    const result = (await call('get_run', { run_id: 'run-long' })).json();
    expect(result.finalResult.length).toBeLessThan(4100);
    expect(result.finalResultCut).toBe(true);
  });

  it('answers an unknown run and an invalid id with a tool error, not a crash', async () => {
    const missing = await call('get_run', { run_id: 'run-nope' });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('no run with id run-nope');
    for (const bad of ['../secrets', 'a/b', 'a b', '', 'x'.repeat(129), 'run-a.jsonl']) {
      const reply = await call('get_run', { run_id: bad });
      expect(reply.isError).toBe(true);
      expect(reply.text).toMatch(/run id|too small|too big|Invalid/i);
    }
    expect((await call('get_run', {})).isError).toBe(true);
    expect((await call('get_run', { run_id: 42 })).isError).toBe(true);
  });

  it('reports a damaged record without leaking a path', async () => {
    const reply = await call('get_run', { run_id: 'broken' });
    expect(reply.isError).toBe(true);
    expect(reply.text).toContain('could not be read');
    expect(reply.text).not.toContain(dir);
  });
});

describe('get_run_events', () => {
  it('pages with a default of 50 and says where the next page starts', async () => {
    const first = (await call('get_run_events', { run_id: 'run-a' })).json();
    expect(first.total).toBe(305);
    expect(first.offset).toBe(0);
    expect(first.limit).toBe(50);
    expect(first.events).toHaveLength(50);
    expect(first.nextOffset).toBe(50);
    expect(first.events[0]).toMatchObject({
      index: 0,
      type: 'run.started',
      task: 'Add Retries to deliver',
    });

    const last = (
      await call('get_run_events', { run_id: 'run-a', offset: 300, limit: 200 })
    ).json();
    expect(last.events.map((event: { index: number }) => event.index)).toEqual([
      300, 301, 302, 303, 304,
    ]);
    expect(last.events.at(-1)).toMatchObject({ type: 'run.finished', status: 'FINISHED' });
    expect(last.nextOffset).toBeNull();
  });

  it('cuts long text and summarizes tool calls', async () => {
    const page = (await call('get_run_events', { run_id: 'run-a', offset: 1, limit: 3 })).json();
    expect(page.events[0].text.length).toBeLessThanOrEqual(501);
    expect(page.events[0].textCut).toBe(true);
    expect(page.events[1]).toMatchObject({
      type: 'tool',
      name: 'shell',
      status: 'running',
      summary: 'shell npm test',
    });
    expect(page.events[2].result).toContain('"exitCode":1');
  });

  it('rejects a limit above 200, a negative offset and a fraction', async () => {
    for (const args of [
      { limit: 201 },
      { limit: 0 },
      { offset: -1 },
      { offset: 1.5 },
      { limit: '5' },
    ]) {
      expect((await call('get_run_events', { run_id: 'run-a', ...args })).isError).toBe(true);
    }
  });

  it('returns an empty page past the end', async () => {
    const page = (await call('get_run_events', { run_id: 'run-b', offset: 1000 })).json();
    expect(page.events).toEqual([]);
    expect(page.nextOffset).toBeNull();
  });
});

describe('get_verdict', () => {
  it('returns the verdict and the decision', async () => {
    const result = (await call('get_verdict', { run_id: 'run-a' })).json();
    expect(result.verdict.risk.tier).toBe('medium');
    expect(result.decision.decision).toBe('changes-requested');
    expect(result.note).toBeUndefined();
  });

  it('says plainly when there is no verdict, and errors for an unknown run', async () => {
    const result = (await call('get_verdict', { run_id: 'run-b' })).json();
    expect(result.verdict).toBeNull();
    expect(result.note).toContain('avero verdict run-b');
    expect((await call('get_verdict', { run_id: 'nope' })).isError).toBe(true);
  });

  it('reports a damaged verdict file as an error', async () => {
    await writeFile(join(dir, 'run-b.verdict.json'), '{ nope');
    const reply = await call('get_verdict', { run_id: 'run-b' });
    expect(reply.isError).toBe(true);
    expect(reply.text).toContain('verdict file');
    await rm(join(dir, 'run-b.verdict.json'));
  });
});

describe('get_changes', () => {
  it('lists the changed files', async () => {
    const result = (await call('get_changes', { run_id: 'run-a' })).json();
    expect(result.files).toHaveLength(3);
    expect(result).toMatchObject({ additions: 5, deletions: 0, patchTruncated: false });
  });

  it('returns the patch for one file only', async () => {
    const result = (await call('get_changes', { run_id: 'run-a', path: 'deliver.test.js' })).json();
    expect(result.patch).toContain('diff --git a/deliver.test.js');
    expect(result.patch).toContain('+b');
    expect(result.patch).not.toContain('new line');
  });

  it('explains a file with no patch, and rejects a path that was not changed', async () => {
    const untracked = (await call('get_changes', { run_id: 'run-a', path: 'scratch.ts' })).json();
    expect(untracked.patch).toBeNull();
    expect(untracked.note).toContain('did not track');
    const other = await call('get_changes', { run_id: 'run-a', path: '../../etc/passwd' });
    expect(other.isError).toBe(true);
    expect(other.text).toContain('not among the changed files');
  });

  it('errors for a run that did not finish', async () => {
    const lines = record({
      runId: 'run-live',
      task: 'Still going',
      startedAt: '2026-11-22T10:00:00.000Z',
    })
      .trim()
      .split('\n');
    await writeFile(join(dir, 'run-live.jsonl'), `${lines.slice(0, 3).join('\n')}\n`);
    const reply = await call('get_changes', { run_id: 'run-live' });
    expect(reply.isError).toBe(true);
    expect(reply.text).toContain('did not finish');
    await rm(join(dir, 'run-live.jsonl'));
  });
});

describe('search_runs', () => {
  it('matches the task and the final result, case-insensitively', async () => {
    const byTask = (await call('search_runs', { query: 'FLAKY' })).json();
    expect(byTask.matches).toHaveLength(1);
    expect(byTask.matches[0]).toMatchObject({ runId: 'run-b', matchedIn: ['task'] });
    const byResult = (await call('search_runs', { query: 'exponential backoff' })).json();
    expect(byResult.matches[0]).toMatchObject({ runId: 'run-a', matchedIn: ['result'] });
    expect(byResult.matches[0].snippet).toContain('exponential backoff');
  });

  it('finds nothing quietly, honours limit, and rejects an empty or huge query', async () => {
    expect((await call('search_runs', { query: 'zzzz-nothing' })).json().matches).toEqual([]);
    expect((await call('search_runs', { query: 'the', limit: 1 })).json().matches).toHaveLength(1);
    expect((await call('search_runs', { query: '   ' })).isError).toBe(true);
    expect((await call('search_runs', { query: 'a'.repeat(201) })).isError).toBe(true);
    expect((await call('search_runs', {})).isError).toBe(true);
  });
});

describe('robustness', () => {
  it('answers an unknown tool without crashing, and keeps working afterwards', async () => {
    const outcome = await client
      .callTool({ name: 'delete_run', arguments: { run_id: 'run-a' } })
      .then(
        (reply) => (reply as Reply).isError === true,
        () => true,
      );
    expect(outcome).toBe(true);
    expect((await call('list_runs')).isError).toBe(false);
  });

  it('treats a missing runs folder as empty', async () => {
    const server = createMcpServer({ dir: join(dir, 'does-not-exist') });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const other = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(serverSide), other.connect(clientSide)]);
    const reply = (await other.callTool({ name: 'list_runs', arguments: {} })) as Reply;
    expect(reply.isError).toBeUndefined();
    expect(JSON.parse(reply.content[0]?.text ?? '{}')).toMatchObject({ total: 0, runs: [] });
    await other.close();
    await server.close();
  });

  it('never writes: the folder holds exactly what the test put there', async () => {
    const { readdir } = await import('node:fs/promises');
    expect((await readdir(dir)).sort()).toEqual([
      'broken.jsonl',
      'run-a.decision.json',
      'run-a.jsonl',
      'run-a.verdict.json',
      'run-b.jsonl',
      'run-long.jsonl',
    ]);
  });
});

describe('over stdio', () => {
  it('starts as the avero-mcp program, lists the tools and answers a call', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(import.meta.dirname, 'bin.ts'), '--runs-dir', dir],
      stderr: 'pipe',
    });
    const remote = new Client({ name: 'stdio-test', version: '0.0.0' });
    await remote.connect(transport);
    try {
      expect((await remote.listTools()).tools).toHaveLength(6);
      const reply = (await remote.callTool({
        name: 'get_run',
        arguments: { run_id: 'run-b' },
      })) as Reply;
      expect(JSON.parse(reply.content[0]?.text ?? '{}').task).toBe('Fix the flaky test');
    } finally {
      await remote.close();
    }
  }, 30_000);
});
