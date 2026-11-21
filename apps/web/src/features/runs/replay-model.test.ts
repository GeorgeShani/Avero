import { parseRunRecord, type RunEvent } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import {
  badgeState,
  buildFeed,
  buildLanes,
  formatClock,
  runLength,
  splitPatch,
  tokensAt,
} from './replay-model';

const usage = (total: number) => ({
  inputTokens: total - 10,
  outputTokens: 10,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: total,
});

const events: RunEvent[] = [
  {
    type: 'run.started',
    seq: 0,
    t: 0,
    v: 1,
    runId: 'r1',
    task: 'Do it',
    model: 'composer-2.5',
    runtime: 'local',
    startedAt: '2026-11-20T10:00:00.000Z',
    workspace: 'demo',
  },
  { type: 'thinking', seq: 1, t: 300, durationMs: 200, text: 'Looking' },
  {
    type: 'tool',
    seq: 2,
    t: 400,
    callId: 'a',
    name: 'read',
    status: 'running',
    args: { path: 'a.js' },
  },
  { type: 'tool', seq: 3, t: 700, callId: 'a', name: 'read', status: 'completed' },
  { type: 'assistant', seq: 4, t: 800, text: 'Editing now.' },
  {
    type: 'tool',
    seq: 5,
    t: 900,
    callId: 'b',
    name: 'shell',
    status: 'running',
    args: { command: 'npm test' },
  },
  { type: 'tool', seq: 6, t: 1500, callId: 'b', name: 'shell', status: 'error' },
  { type: 'usage', seq: 7, t: 1600, usage: usage(500) },
  { type: 'gate', seq: 7, t: 1650, kind: 'limit', outcome: 'tripped', detail: 'Time cap reached' },
  {
    type: 'run.finished',
    seq: 8,
    t: 2000,
    status: 'FINISHED',
    durationMs: 2000,
    usage: usage(800),
  },
];
const record = parseRunRecord(events.map((event) => JSON.stringify(event)).join('\n'));

describe('buildLanes', () => {
  it('makes one lane per kind of work that happened, in a fixed order', () => {
    const lanes = buildLanes(record);
    expect(lanes.map((lane) => lane.kind)).toEqual(['thinking', 'read', 'shell']);
    expect(lanes[1]?.bars[0]).toMatchObject({
      start: 400,
      end: 700,
      label: 'read a.js',
      failed: false,
    });
    expect(lanes[2]?.bars[0]?.failed).toBe(true);
  });

  it('places thinking so it ends where its event was recorded', () => {
    expect(buildLanes(record)[0]?.bars[0]).toMatchObject({ start: 100, end: 300 });
  });
});

describe('buildFeed', () => {
  it('lists tool calls, messages and thinking in time order', () => {
    const feed = buildFeed(record);
    expect(feed.map((row) => [row.t, row.kind])).toEqual([
      [300, 'thinking'],
      [400, 'tool'],
      [800, 'assistant'],
      [900, 'tool'],
      [1650, 'gate'],
    ]);
    expect(feed[1]).toMatchObject({ title: 'read a.js', took: 300 });
    expect(feed[3]?.failed).toBe(true);
    expect(feed[4]).toMatchObject({
      title: 'limit tripped',
      detail: 'Time cap reached',
      failed: true,
    });
  });
});

describe('runLength and tokensAt', () => {
  it('uses the recorded duration, and the latest usage report at or before a moment', () => {
    expect(runLength(record)).toBe(2000);
    expect(tokensAt(record, 100)).toBe(0);
    expect(tokensAt(record, 1700)).toBe(500);
    expect(tokensAt(record, 2000)).toBe(800);
  });
});

describe('splitPatch', () => {
  const patch = [
    'diff --git a/deliver.js b/deliver.js',
    'index 1..2 100644',
    '--- a/deliver.js',
    '+++ b/deliver.js',
    '@@ -1,2 +1,3 @@',
    ' keep',
    '-old',
    '+new',
    '+newer',
    'diff --git a/b.txt b/b.txt',
    '@@ -0,0 +1 @@',
    '+hi',
    '',
  ].join('\n');

  it('splits a diff by file and labels each line', () => {
    const files = splitPatch(patch);
    expect(files.map((file) => file.path)).toEqual(['deliver.js', 'b.txt']);
    expect(files[0]?.lines.map((line) => line.kind)).toEqual([
      'meta',
      'meta',
      'meta',
      'hunk',
      'ctx',
      'del',
      'add',
      'add',
    ]);
  });

  it('returns nothing for no patch', () => {
    expect(splitPatch(undefined)).toEqual([]);
    expect(splitPatch('')).toEqual([]);
  });
});

describe('badgeState and formatClock', () => {
  it('maps run status to the status badge', () => {
    expect(badgeState('FINISHED')).toBe('completed');
    expect(badgeState('RUNNING')).toBe('running');
    expect(badgeState('ERROR')).toBe('failed');
    expect(badgeState('CANCELLED')).toBe('cancelled');
  });

  it('formats a clock as mm:ss.t', () => {
    expect(formatClock(0)).toBe('00:00.0');
    expect(formatClock(61_500)).toBe('01:01.5');
  });
});
