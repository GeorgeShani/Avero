import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileRunSource, readDecision } from '@avero/run-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordDecision } from './decisions';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-decide-'));
  await writeFile(
    join(dir, 'run-1.jsonl'),
    JSON.stringify({
      type: 'run.started',
      seq: 0,
      t: 0,
      v: 1,
      runId: 'run-1',
      task: 'Do it',
      model: 'composer-2.5',
      runtime: 'local',
      startedAt: '2026-11-20T10:00:00.000Z',
      workspace: 'demo',
    }),
  );
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const deps = () => ({
  source: fileRunSource(dir),
  readOnly: false,
  now: () => new Date('2026-11-20T12:00:00Z'),
});

describe('recordDecision', () => {
  it('saves the decision with its note and time', async () => {
    const result = await recordDecision(
      { runId: 'run-1', decision: 'changes-requested', note: '  use jitter  ' },
      deps(),
    );
    expect(result).toEqual({ ok: true });
    expect(await readDecision(dir, 'run-1')).toMatchObject({
      decision: 'changes-requested',
      note: 'use jitter',
      decidedAt: '2026-11-20T12:00:00.000Z',
    });
  });

  it('leaves the note out when it is blank', async () => {
    await recordDecision({ runId: 'run-1', decision: 'approved', note: '   ' }, deps());
    expect((await readDecision(dir, 'run-1'))?.note).toBeUndefined();
  });

  it('does nothing on a read-only viewer', async () => {
    const result = await recordDecision(
      { runId: 'run-1', decision: 'approved', note: '' },
      { ...deps(), readOnly: true },
    );
    expect(result).toEqual({ ok: false, error: 'This viewer is read-only.' });
    expect(await readDecision(dir, 'run-1')).toBeUndefined();
  });

  it('refuses a run id that could leave the folder, an unknown decision, and a missing run', async () => {
    expect(
      await recordDecision({ runId: '../x', decision: 'approved', note: '' }, deps()),
    ).toMatchObject({ ok: false });
    expect(
      await recordDecision({ runId: 'run-1', decision: 'merge', note: '' }, deps()),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('approve'),
    });
    expect(await recordDecision({ runId: 'nope', decision: 'approved', note: '' }, deps())).toEqual(
      {
        ok: false,
        error: 'There is no such run.',
      },
    );
  });

  it('refuses a note that is too long', async () => {
    const result = await recordDecision(
      { runId: 'run-1', decision: 'approved', note: 'x'.repeat(2001) },
      deps(),
    );
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('longer than') });
  });

  it('replaces an earlier decision', async () => {
    await recordDecision({ runId: 'run-1', decision: 'rejected', note: 'no' }, deps());
    await recordDecision({ runId: 'run-1', decision: 'approved', note: '' }, deps());
    expect((await readDecision(dir, 'run-1'))?.decision).toBe('approved');
  });
});
