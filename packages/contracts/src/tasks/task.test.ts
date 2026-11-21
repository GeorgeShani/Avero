import { describe, expect, it } from 'vitest';
import {
  canTransition,
  isTerminal,
  taskCreateSchema,
  taskStatuses,
  taskTransitions,
} from './task.ts';

describe('task lifecycle', () => {
  it('lets a queued task be claimed or cancelled, and nothing else', () => {
    expect(taskTransitions.queued).toEqual(['running', 'cancelled']);
  });

  it('never moves a finished, failed or cancelled task again', () => {
    for (const status of ['finished', 'failed', 'cancelled'] as const) {
      expect(isTerminal(status)).toBe(true);
      for (const next of taskStatuses) expect(canTransition(status, next)).toBe(false);
    }
  });

  it('can always reach an end from any state that is not one', () => {
    const reaches = (from: (typeof taskStatuses)[number], seen = new Set<string>()): boolean => {
      if (isTerminal(from)) return true;
      if (seen.has(from)) return false;
      seen.add(from);
      return taskTransitions[from].some((next) => reaches(next, seen));
    };
    for (const status of taskStatuses) expect(reaches(status)).toBe(true);
  });

  it('only allows stopping what is running', () => {
    expect(canTransition('running', 'cancelling')).toBe(true);
    expect(canTransition('queued', 'cancelling')).toBe(false);
    expect(canTransition('cancelling', 'running')).toBe(false);
  });
});

describe('task creation input', () => {
  const repositoryId = '11111111-1111-4111-8111-111111111111';

  it('trims the prompt and refuses an empty or oversized one', () => {
    expect(taskCreateSchema.parse({ repositoryId, prompt: '  fix it  ' }).prompt).toBe('fix it');
    expect(taskCreateSchema.safeParse({ repositoryId, prompt: '   ' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ repositoryId, prompt: 'x'.repeat(8001) }).success).toBe(
      false,
    );
  });

  it('refuses unknown fields and unreasonable limits', () => {
    expect(
      taskCreateSchema.safeParse({ repositoryId, prompt: 'a', status: 'finished' }).success,
    ).toBe(false);
    expect(
      taskCreateSchema.safeParse({ repositoryId, prompt: 'a', limits: { maxSeconds: 0 } }).success,
    ).toBe(false);
  });
});
