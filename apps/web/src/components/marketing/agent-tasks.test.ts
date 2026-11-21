import { describe, expect, it } from 'vitest';
import { shellStartMs, tasks } from './agent-tasks';
import { cheapestSetup, setups } from './bench-data';

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

  it('ends the bench task on the setup with the fewest tokens per resolved task', () => {
    const bench = tasks.find((task) => task.id === 'bench');
    const last = bench?.stages.at(-1)?.steps.at(-1);
    expect(last?.args?.[0]).toBe(cheapestSetup()?.label);
  });

  it('looks at every setup before settling', () => {
    const bench = tasks.find((task) => task.id === 'bench');
    const tried = bench?.stages.flatMap((stage) => stage.steps.map((step) => step.args?.[0]));
    for (const setup of setups) expect(tried).toContain(setup.label);
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
