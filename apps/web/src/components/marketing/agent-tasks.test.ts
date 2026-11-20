import { describe, expect, it } from 'vitest';
import { shellStartMs, tasks } from './agent-tasks';
import { cheapestEffort, efforts, perResolved } from './run-data';

describe('scripted agent tasks', () => {
  it('gives every task at least one stage, and every stage a named target and an action', () => {
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.stages.length).toBeGreaterThan(0);
      for (const stage of task.stages) {
        expect(stage.focus).not.toBe('');
        expect(stage.steps.length).toBeGreaterThan(0);
        for (const step of stage.steps) {
          expect(step.ref).not.toBe('');
          expect(step.action).not.toBe('');
        }
      }
    }
  });

  it('ends the bench task on the setup with the lowest cost per resolved task', () => {
    const bench = tasks.find((task) => task.id === 'bench');
    const last = bench?.stages.at(-1)?.steps.at(-1);
    expect(last?.args?.[0]).toBe(cheapestEffort('Tuned'));
  });

  it('tries every effort level before settling', () => {
    const bench = tasks.find((task) => task.id === 'bench');
    const tried = bench?.stages.flatMap((stage) => stage.steps.map((step) => step.args?.[0]));
    for (const effort of efforts) expect(tried).toContain(effort);
  });

  it('aims at a control the agent is not allowed to press on its own', () => {
    const review = tasks.find((task) => task.id === 'review');
    const press = review?.stages.at(-1)?.steps.at(-1);
    expect(press).toMatchObject({ ref: 'Approve anyway', action: 'press' });
  });
});

describe('the replay task', () => {
  it('speeds up to a speed the replay offers and jumps to a time inside the recording', () => {
    const replay = tasks.find((task) => task.id === 'replay');
    const args = replay?.stages.flatMap((stage) => stage.steps.map((step) => step.args?.[0]));
    expect(args).toContain('16x');
    expect(shellStartMs).toBeGreaterThan(0);
    expect(args).toContain(shellStartMs);
  });
});

describe('cost per resolved task', () => {
  it('divides the cost by the share of tasks resolved', () => {
    expect(perResolved('Baseline', 'low')).toBeCloseTo(0.38 / 0.52, 5);
  });

  it('picks the lowest of the four efforts', () => {
    for (const rules of ['Baseline', 'Tuned'] as const) {
      const best = cheapestEffort(rules);
      for (const effort of efforts) {
        expect(perResolved(rules, best)).toBeLessThanOrEqual(perResolved(rules, effort));
      }
    }
  });
});
