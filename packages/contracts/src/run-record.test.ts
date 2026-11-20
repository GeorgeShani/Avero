import { describe, expect, it } from 'vitest';
import {
  describeToolCall,
  parseRunRecord,
  RunRecordError,
  summarizeRun,
  toolKind,
  toolSpans,
  type RunEvent,
} from './run-record.ts';

const started: RunEvent = {
  type: 'run.started',
  seq: 0,
  t: 0,
  v: 1,
  runId: 'run-1',
  task: 'Add a retry',
  model: 'composer-2.5',
  runtime: 'local',
  startedAt: '2026-11-20T10:00:00.000Z',
  workspace: 'demo',
};

const lines = (events: RunEvent[]) => events.map((event) => JSON.stringify(event)).join('\n');

const usage = {
  inputTokens: 100,
  outputTokens: 20,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 120,
};

const events: RunEvent[] = [
  started,
  { type: 'status', seq: 1, t: 5, status: 'RUNNING' },
  {
    type: 'tool',
    seq: 2,
    t: 100,
    callId: 'a',
    name: 'read',
    status: 'running',
    args: { path: 'x.ts' },
  },
  { type: 'tool', seq: 3, t: 400, callId: 'a', name: 'read', status: 'completed', result: 'ok' },
  { type: 'tool', seq: 4, t: 500, callId: 'b', name: 'edit', status: 'running' },
  { type: 'tool', seq: 5, t: 900, callId: 'b', name: 'edit', status: 'completed' },
  { type: 'usage', seq: 6, t: 950, usage },
  {
    type: 'run.finished',
    seq: 7,
    t: 1000,
    status: 'FINISHED',
    durationMs: 1000,
    usage,
    cost: { rawCents: 1.2, chargedCents: 1.5 },
    changes: {
      files: [{ path: 'x.ts', status: 'modified', additions: 6, deletions: 1 }],
      additions: 6,
      deletions: 1,
    },
  },
];

describe('parseRunRecord', () => {
  it('reads a finished record', () => {
    const record = parseRunRecord(lines(events));
    expect(record.started.runId).toBe('run-1');
    expect(record.finished?.status).toBe('FINISHED');
    expect(record.events).toHaveLength(events.length - 1);
  });

  it('accepts a record with no run.finished, which is a run still going or cut off', () => {
    const record = parseRunRecord(lines(events.slice(0, 4)));
    expect(record.finished).toBeUndefined();
    expect(summarizeRun(record).status).toBe('RUNNING');
  });

  it('names the line of a bad event', () => {
    const text = `${lines(events.slice(0, 2))}\n{"type":"tool","seq":2,"t":1}`;
    expect(() => parseRunRecord(text)).toThrow(RunRecordError);
    expect(() => parseRunRecord(text)).toThrow(/Line 3/);
  });

  it('rejects text that is not JSON and records that do not start with run.started', () => {
    expect(() => parseRunRecord('nope')).toThrow(/not valid JSON/);
    expect(() => parseRunRecord(lines(events.slice(1)))).toThrow(/starts with run.started/);
  });

  it('rejects an event with a field it does not know', () => {
    const bad = JSON.stringify({ ...events[1], extra: true });
    expect(() => parseRunRecord(`${lines([started])}\n${bad}`)).toThrow(/Line 2/);
  });

  it('ignores blank lines and Windows line endings', () => {
    const record = parseRunRecord(`${lines(events).replaceAll('\n', '\r\n')}\r\n\r\n`);
    expect(record.finished).toBeDefined();
  });
});

describe('toolSpans', () => {
  it('pairs running and completed events by call id', () => {
    const spans = toolSpans(parseRunRecord(lines(events)));
    expect(spans.map((span) => [span.name, span.start, span.end, span.status])).toEqual([
      ['read', 100, 400, 'completed'],
      ['edit', 500, 900, 'completed'],
    ]);
    expect(spans[0]?.args).toEqual({ path: 'x.ts' });
    expect(spans[0]?.result).toBe('ok');
  });

  it('leaves a call that never completed open until the last event', () => {
    const spans = toolSpans(parseRunRecord(lines(events.slice(0, 5))));
    expect(spans[1]).toMatchObject({ status: 'running', end: 500 });
  });
});

describe('summarizeRun', () => {
  it('totals tokens, cost, calls and changes', () => {
    expect(summarizeRun(parseRunRecord(lines(events)))).toMatchObject({
      status: 'FINISHED',
      durationMs: 1000,
      totalTokens: 120,
      costCents: 1.5,
      toolCalls: 2,
      filesChanged: 1,
      additions: 6,
      deletions: 1,
    });
  });
});

describe('toolKind', () => {
  it('groups tools by what they do', () => {
    expect(toolKind('read')).toBe('read');
    expect(toolKind('grep')).toBe('search');
    expect(toolKind('edit')).toBe('edit');
    expect(toolKind('shell')).toBe('shell');
    expect(toolKind('someMcpTool')).toBe('other');
  });
});

describe('describeToolCall', () => {
  it('names the file, command or pattern a call used', () => {
    expect(describeToolCall('read', { path: 'src/a.ts' })).toBe('read src/a.ts');
    expect(describeToolCall('shell', { command: 'pnpm   test' })).toBe('shell pnpm test');
    expect(describeToolCall('grep', { pattern: 'retry' })).toBe('grep retry');
  });

  it('falls back to the tool name, and cuts a long value', () => {
    expect(describeToolCall('ls', undefined)).toBe('ls');
    expect(describeToolCall('ls', { other: 1 })).toBe('ls');
    expect(describeToolCall('shell', { command: 'x'.repeat(200) }).length).toBeLessThan(90);
  });
});
