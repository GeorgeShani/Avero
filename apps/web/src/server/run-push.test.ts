import type { Verdict, Workspace } from '@avero/contracts';
import { describe, expect, it, vi } from 'vitest';
import { pushRun } from './run-push';

const record = (runId: string) =>
  JSON.stringify({
    type: 'run.started',
    seq: 0,
    t: 0,
    v: 1,
    runId,
    task: 'Do it',
    model: 'composer-2.5',
    runtime: 'local',
    startedAt: '2026-11-20T10:00:00.000Z',
    workspace: 'demo',
  });

const verdict = (runId: string): Verdict => ({
  v: 1,
  runId,
  summary: 'Fine.',
  checks: [{ id: 'c', claim: 'Does it', verdict: 'pass', evidence: 'Yes.' }],
  outOfScope: [],
  tests: { ran: true, passed: true, evidence: 'Passed.' },
  risk: { tier: 'low', reasons: [] },
  reviewer: { model: 'm', reviewedAt: '2026-11-20T11:00:00.000Z' },
  adjustments: [],
});

const workspace = (role: Workspace['role']): Workspace => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Team',
  slug: 'team-1',
  role,
});

function deps(found: Workspace | undefined) {
  return {
    findWorkspace: vi.fn().mockResolvedValue(found),
    save: vi.fn().mockResolvedValue({ runId: 'r1', created: true }),
  };
}

const call = (body: unknown, found: Workspace | undefined, d = deps(found)) =>
  pushRun({ userId: 'user_1', workspaceId: '11111111-1111-4111-8111-111111111111', body }, d).then(
    (result) => ({ result, d }),
  );

describe('pushRun', () => {
  it('saves a valid run for a member and says it was created', async () => {
    const { result, d } = await call({ record: record('r1') }, workspace('member'));
    expect(result).toEqual({ status: 201, body: { runId: 'r1', created: true } });
    expect(d.save).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      { record: record('r1'), verdict: undefined, decision: undefined },
      'user_1',
    );
  });

  it('answers 200 when the run was already there and is replaced', async () => {
    const d = deps(workspace('admin'));
    d.save.mockResolvedValue({ runId: 'r1', created: false });
    const { result } = await call({ record: record('r1') }, workspace('admin'), d);
    expect(result.status).toBe(200);
  });

  it('answers 404 for a workspace the person is not in, and saves nothing', async () => {
    const { result, d } = await call({ record: record('r1') }, undefined);
    expect(result).toEqual({ status: 404, body: { error: 'Workspace not found' } });
    expect(d.save).not.toHaveBeenCalled();
  });

  it('answers 403 for a viewer, and saves nothing', async () => {
    const { result, d } = await call({ record: record('r1') }, workspace('viewer'));
    expect(result.status).toBe(403);
    expect(d.save).not.toHaveBeenCalled();
  });

  it('refuses a body that is not the push envelope, or a record that is not a run record', async () => {
    for (const body of [null, 'x', {}, { record: '' }, { record: record('r1'), extra: 1 }]) {
      expect((await call(body, workspace('owner'))).result.status).toBe(400);
    }
    const { result, d } = await call({ record: 'not a record' }, workspace('owner'));
    expect(result).toEqual({
      status: 400,
      body: { error: 'The record is not a valid Avero run record' },
    });
    expect(d.save).not.toHaveBeenCalled();
  });

  it('refuses a verdict or decision that is invalid or belongs to another run', async () => {
    const wrongVerdict = await call(
      { record: record('r1'), verdict: verdict('other') },
      workspace('owner'),
    );
    expect(wrongVerdict.result).toEqual({
      status: 400,
      body: { error: 'The verdict is for a different run' },
    });
    const badVerdict = await call(
      { record: record('r1'), verdict: { nope: 1 } },
      workspace('owner'),
    );
    expect(badVerdict.result.status).toBe(400);
    const wrongDecision = await call(
      {
        record: record('r1'),
        decision: {
          v: 1,
          runId: 'other',
          decision: 'approved',
          decidedAt: '2026-11-20T12:00:00.000Z',
        },
      },
      workspace('owner'),
    );
    expect(wrongDecision.result).toEqual({
      status: 400,
      body: { error: 'The decision is for a different run' },
    });
    expect(wrongDecision.d.save).not.toHaveBeenCalled();
  });

  it('passes a matching verdict and decision along', async () => {
    const decision = {
      v: 1,
      runId: 'r1',
      decision: 'approved',
      decidedAt: '2026-11-20T12:00:00.000Z',
    };
    const { result, d } = await call(
      { record: record('r1'), verdict: verdict('r1'), decision },
      workspace('owner'),
    );
    expect(result.status).toBe(201);
    expect(d.save.mock.calls[0]?.[1]).toMatchObject({ verdict: verdict('r1'), decision });
  });
});
