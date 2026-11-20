import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunWriter, isRunId, listRuns, readRun, runsDir } from './index.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-store-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const started = (runId: string, startedAt: string) =>
  JSON.stringify({
    type: 'run.started',
    seq: 0,
    t: 0,
    v: 1,
    runId,
    task: 'Do it',
    model: 'composer-2.5',
    runtime: 'local',
    startedAt,
    workspace: 'demo',
  });

describe('runsDir', () => {
  it('uses AVERO_RUNS_DIR when set, otherwise .avero/runs under the folder', () => {
    expect(runsDir('/work', { AVERO_RUNS_DIR: '/elsewhere' })).toBe('/elsewhere');
    expect(runsDir('/work', {})).toBe(join('/work', '.avero', 'runs'));
  });
});

describe('writing and reading', () => {
  it('appends lines in order and reads them back', async () => {
    const writer = await createRunWriter(dir, 'run-1');
    await writer.write(started('run-1', '2026-11-20T10:00:00.000Z'));
    await writer.write(JSON.stringify({ type: 'status', seq: 1, t: 5, status: 'RUNNING' }));
    const record = await readRun(dir, 'run-1');
    expect(record.started.runId).toBe('run-1');
    expect(record.events).toHaveLength(1);
  });

  it('refuses a run id that could leave the folder', async () => {
    expect(isRunId('../secrets')).toBe(false);
    expect(isRunId('run-1')).toBe(true);
    await expect(readRun(dir, '../secrets')).rejects.toThrow(/valid run id/);
    await expect(createRunWriter(dir, 'a/b')).rejects.toThrow(/valid run id/);
  });
});

describe('listRuns', () => {
  it('returns an empty list when the folder does not exist', async () => {
    expect(await listRuns(join(dir, 'missing'))).toEqual({ runs: [], problems: [] });
  });

  it('lists runs newest first and reports a broken file instead of hiding it', async () => {
    await writeFile(join(dir, 'old.jsonl'), started('old', '2026-11-19T10:00:00.000Z'));
    await writeFile(join(dir, 'new.jsonl'), started('new', '2026-11-20T10:00:00.000Z'));
    await writeFile(join(dir, 'broken.jsonl'), 'not json');
    await writeFile(join(dir, 'notes.txt'), 'ignored');
    const { runs, problems } = await listRuns(dir);
    expect(runs.map((run) => run.runId)).toEqual(['new', 'old']);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe('broken.jsonl');
  });
});
