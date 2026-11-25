import { describe, expect, it } from 'vitest';
import type { HostedState } from '../console-shell/hosted';
import { isComplete, localSteps, nextStep, workspaceSteps, type SetupInput } from './setup-status';

const none = { total: 0, reviewed: 0, decided: 0 };

function input(overrides: Partial<SetupInput> = {}): SetupInput {
  return {
    runs: none,
    suites: 0,
    cursorKey: false,
    hosted: { status: 'unavailable' },
    ...overrides,
  };
}

const states = (steps: ReturnType<typeof localSteps>) =>
  Object.fromEntries(steps.map((step) => [step.id, step.state]));

describe('localSteps', () => {
  it('starts at the key, and holds review and decision until a run exists', () => {
    expect(states(localSteps(input()))).toEqual({
      key: 'next',
      record: 'later',
      review: 'later',
      decide: 'later',
      evaluate: 'later',
    });
  });

  it('moves on to recording once a key is visible', () => {
    expect(nextStep(localSteps(input({ cursorKey: true })))?.id).toBe('record');
  });

  it('treats a recorded run as proof the key was ready', () => {
    const steps = localSteps(
      input({ runs: { total: 2, reviewed: 0, decided: 0, firstRunId: 'r1' } }),
    );
    expect(states(steps).key).toBe('done');
    expect(nextStep(steps)?.id).toBe('review');
    // The command names a real run instead of a placeholder.
    expect(steps.find((step) => step.id === 'review')?.command).toBe('pnpm avero verdict r1');
  });

  it('is complete without the optional evaluation step', () => {
    const steps = localSteps(input({ runs: { total: 3, reviewed: 2, decided: 1 } }));
    expect(isComplete(steps)).toBe(true);
    expect(nextStep(steps)).toBeUndefined();
  });
});

describe('workspaceSteps', () => {
  it('is one blocked step when the server has no sign-in or database', () => {
    const steps = workspaceSteps(input());
    expect(steps).toHaveLength(1);
    expect(steps[0]?.state).toBe('blocked');
    expect(isComplete(steps)).toBe(false);
  });

  it('asks a signed-out visitor to sign in first', () => {
    const steps = workspaceSteps(input({ hosted: { status: 'signed-out' } }));
    expect(nextStep(steps)?.id).toBe('sign-in');
  });

  it('asks a signed-in person with no workspace to create one', () => {
    const hosted: HostedState = { status: 'signed-in', workspaces: [], toDecide: 0 };
    expect(nextStep(workspaceSteps(input({ hosted })))?.id).toBe('workspace');
  });

  it('walks from repository to task to a finished run', () => {
    const hosted: HostedState = {
      status: 'signed-in',
      workspaces: [{ id: 'w', name: 'W' }],
      selectedId: 'w',
      toDecide: 0,
    };
    const workspace = {
      repositories: 1,
      agents: 0,
      tasks: { total: 0, active: 0, queued: 0, finished: 0, failed: 0 },
      toDecide: 0,
      risky: 0,
    };
    expect(
      nextStep(workspaceSteps(input({ hosted, workspace: { ...workspace, repositories: 0 } })))?.id,
    ).toBe('repository');
    expect(nextStep(workspaceSteps(input({ hosted, workspace })))?.id).toBe('task');
    const launched = { ...workspace, tasks: { ...workspace.tasks, total: 1 } };
    expect(nextStep(workspaceSteps(input({ hosted, workspace: launched })))?.id).toBe('result');
  });
});
