import { describe, expect, it } from 'vitest';
import { toAgentTrace, type AgentTrace } from './agent-trace.ts';
import { parseUnifiedDiff } from './patch.ts';
import { sampleRecord } from './test-fixtures.ts';

/** Checks a trace against the shape of the published JSON Schema: required fields, no extras. */
function expectSpecShape(trace: AgentTrace) {
  const only = (value: object, allowed: string[]) =>
    expect(Object.keys(value).filter((key) => !allowed.includes(key))).toEqual([]);
  only(trace, ['version', 'id', 'timestamp', 'files', 'vcs', 'tool', 'metadata']);
  expect(trace.version).toMatch(/^[0-9]+\.[0-9]+$/);
  expect(trace.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(Number.isNaN(Date.parse(trace.timestamp))).toBe(false);
  expect(trace.timestamp).toMatch(/Z$/);
  expect(trace.tool.name).not.toBe('');
  expect(trace.tool.version).not.toBe('');
  if (trace.vcs) {
    only(trace.vcs, ['type', 'revision']);
    expect(['git', 'jj', 'hg', 'svn']).toContain(trace.vcs.type);
  }
  for (const file of trace.files) {
    only(file, ['path', 'conversations']);
    expect(file.path).not.toMatch(/^\//);
    expect(file.conversations.length).toBeGreaterThan(0);
    for (const conversation of file.conversations) {
      only(conversation, ['contributor', 'ranges']);
      expect(['human', 'ai', 'mixed', 'unknown']).toContain(conversation.contributor.type);
      expect(conversation.contributor.model_id.length).toBeLessThanOrEqual(250);
      expect(conversation.ranges.length).toBeGreaterThan(0);
      for (const range of conversation.ranges) {
        only(range, ['start_line', 'end_line']);
        expect(Number.isInteger(range.start_line)).toBe(true);
        expect(range.start_line).toBeGreaterThanOrEqual(1);
        expect(range.end_line).toBeGreaterThanOrEqual(range.start_line);
      }
    }
  }
}

const trace = (patch: string, extra: Parameters<typeof sampleRecord>[0] = {}) =>
  toAgentTrace(sampleRecord({ patch, ...extra }));

describe('parseUnifiedDiff', () => {
  it('finds the added lines of a modified file by their new line numbers, merging neighbours', () => {
    const [file] = parseUnifiedDiff(
      [
        'diff --git a/a.ts b/a.ts',
        '--- a/a.ts',
        '+++ b/a.ts',
        '@@ -1,4 +1,6 @@',
        '+one',
        ' two',
        '-old',
        '+three',
        '+four',
        '-gone',
        '+five',
        ' six',
      ].join('\n'),
    );
    // new file: 1 one, 2 two, 3 three, 4 four, 5 five, 6 six
    expect(file?.added).toEqual([
      { start: 1, end: 1 },
      { start: 3, end: 5 },
    ]);
  });

  it('reads a path that git quotes, and a rename', () => {
    const files = parseUnifiedDiff(
      [
        'diff --git "a/caf\\303\\251 x.txt" "b/caf\\303\\251 x.txt"',
        '--- "a/caf\\303\\251 x.txt"',
        '+++ "b/caf\\303\\251 x.txt"',
        '@@ -1 +1 @@',
        '-a',
        '+b',
        'diff --git a/old name.ts b/new name.ts',
        'similarity index 80%',
        'rename from old name.ts',
        'rename to new name.ts',
        '--- a/old name.ts',
        '+++ b/new name.ts',
        '@@ -2 +2,2 @@',
        ' keep',
        '+more',
      ].join('\n'),
    );
    expect(files.map((file) => file.path)).toEqual(['café x.txt', 'new name.ts']);
    expect(files[1]?.added).toEqual([{ start: 3, end: 3 }]);
  });
});

describe('toAgentTrace', () => {
  it('converts a run with a modified file and a new file', () => {
    const result = toAgentTrace(sampleRecord());
    expectSpecShape(result);
    expect(result.files).toEqual([
      {
        path: 'src/retry.ts',
        conversations: [
          {
            contributor: { type: 'ai', model_id: 'composer-2.5' },
            ranges: [
              { start_line: 1, end_line: 1 },
              { start_line: 3, end_line: 4 },
            ],
          },
        ],
      },
      {
        path: 'src/new.ts',
        conversations: [
          {
            contributor: { type: 'ai', model_id: 'composer-2.5' },
            ranges: [{ start_line: 1, end_line: 2 }],
          },
        ],
      },
    ]);
    expect(result.vcs).toEqual({
      type: 'git',
      revision: 'ae2a311999b5f89a07ad00b5cb458e94f306dbca',
    });
    expect(result.tool).toEqual({ name: 'avero', version: '0.0.0' });
    expect(result.version).toBe('0.1');
    // 7 seconds after the run started.
    expect(result.timestamp).toBe('2026-11-20T10:00:07.000Z');
  });

  it('handles several hunks in one file', () => {
    const result = trace(
      [
        'diff --git a/big.ts b/big.ts',
        '--- a/big.ts',
        '+++ b/big.ts',
        '@@ -3,3 +3,4 @@',
        ' c3',
        '+added at 4',
        ' c4',
        ' c5',
        '@@ -40,2 +41,4 @@',
        ' c40',
        '+added at 42',
        '+added at 43',
        ' c41',
        '@@ -90,1 +94,0 @@',
        '-removed only',
        '@@ -100 +103,2 @@',
        '+tail one',
        '+tail two',
        '\\ No newline at end of file',
      ].join('\n'),
    );
    expectSpecShape(result);
    expect(result.files[0]?.conversations[0]?.ranges).toEqual([
      { start_line: 4, end_line: 4 },
      { start_line: 42, end_line: 43 },
      { start_line: 103, end_line: 104 },
    ]);
  });

  it('lists a new file from its patch, from line 1 to its last line', () => {
    const result = trace(
      [
        'diff --git a/docs/new.md b/docs/new.md',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/docs/new.md',
        '@@ -0,0 +1,3 @@',
        '+# Title',
        '+',
        '+text',
      ].join('\n'),
      { files: [{ path: 'docs/new.md', status: 'added', additions: 3, deletions: 0 }] },
    );
    expectSpecShape(result);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.conversations[0]?.ranges).toEqual([{ start_line: 1, end_line: 3 }]);
  });

  it('leaves out a file the run only deleted, and a deleted file', () => {
    const result = trace(
      [
        'diff --git a/trim.ts b/trim.ts',
        '--- a/trim.ts',
        '+++ b/trim.ts',
        '@@ -1,4 +1,2 @@',
        ' keep',
        '-drop one',
        '-drop two',
        ' keep too',
        'diff --git a/gone.ts b/gone.ts',
        'deleted file mode 100644',
        '--- a/gone.ts',
        '+++ /dev/null',
        '@@ -1,2 +0,0 @@',
        '-a',
        '-b',
        'diff --git a/kept.ts b/kept.ts',
        '--- a/kept.ts',
        '+++ b/kept.ts',
        '@@ -1 +1,2 @@',
        ' x',
        '+y',
      ].join('\n'),
      {
        files: [
          { path: 'trim.ts', status: 'modified', additions: 0, deletions: 2 },
          { path: 'gone.ts', status: 'deleted', additions: 0, deletions: 2 },
          { path: 'kept.ts', status: 'modified', additions: 1, deletions: 0 },
        ],
      },
    );
    expectSpecShape(result);
    expect(result.files.map((file) => file.path)).toEqual(['kept.ts']);
  });

  it('gives an empty file list when the run changed nothing the agent wrote', () => {
    const result = trace('', { files: [] });
    expectSpecShape(result);
    expect(result.files).toEqual([]);
  });

  it('lists a whole untracked file that has no patch, from its line count', () => {
    const result = trace('', {
      files: [
        { path: 'scratch/new.ts', status: 'untracked', additions: 12, deletions: 0 },
        { path: 'image.png', status: 'untracked', additions: null, deletions: null },
      ],
    });
    expectSpecShape(result);
    expect(result.files).toEqual([
      {
        path: 'scratch/new.ts',
        conversations: [
          {
            contributor: { type: 'ai', model_id: 'composer-2.5' },
            ranges: [{ start_line: 1, end_line: 12 }],
          },
        ],
      },
    ]);
  });

  it('omits vcs when the run recorded no commit, and takes an explicit revision', () => {
    const record = sampleRecord();
    const noGit = toAgentTrace({ ...record, started: { ...record.started, git: undefined } });
    expect(noGit.vcs).toBeUndefined();
    expectSpecShape(noGit);

    const committed = toAgentTrace(record, { revision: 'f'.repeat(40) });
    expect(committed.vcs?.revision).toBe('f'.repeat(40));
    expect((committed.metadata['dev.avero'] as { baseRevision: string }).baseRevision).toBe(
      'ae2a311999b5f89a07ad00b5cb458e94f306dbca',
    );
  });

  it('uses the tool name, version, provider and spec version it is given', () => {
    const result = toAgentTrace(sampleRecord(), {
      toolName: 'avero-cli',
      version: '1.2.3',
      provider: 'cursor',
      specVersion: '0.2',
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.tool).toEqual({ name: 'avero-cli', version: '1.2.3' });
    expect(result.version).toBe('0.2');
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.files[0]?.conversations[0]?.contributor.model_id).toBe('cursor/composer-2.5');
  });

  it('derives the same id for the same run and a different one for another run', () => {
    const one = toAgentTrace(sampleRecord());
    expect(toAgentTrace(sampleRecord()).id).toBe(one.id);
    expect(toAgentTrace(sampleRecord({ runId: 'run-other' })).id).not.toBe(one.id);
  });

  it('records how the run ended and whether the patch was cut', () => {
    const record = sampleRecord();
    const events = record.events.map((event) =>
      event.type === 'run.finished' && event.changes
        ? { ...event, changes: { ...event.changes, patchTruncated: true } }
        : event,
    );
    const finished = events.find((event) => event.type === 'run.finished');
    const result = toAgentTrace({
      started: record.started,
      events,
      ...(finished?.type === 'run.finished' ? { finished } : {}),
    });
    expect(result.metadata['dev.avero']).toEqual({
      runId: 'run-sample',
      baseRevision: 'ae2a311999b5f89a07ad00b5cb458e94f306dbca',
      dirtyBeforeRun: false,
      runStatus: 'FINISHED',
      patchTruncated: true,
    });
  });
});
