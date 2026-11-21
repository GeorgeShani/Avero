import type { Task } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { taskActivity } from './activity';

const task = (id: string, extra: Partial<Task>): Task => ({
  id,
  repositoryId: '22222222-2222-4222-8222-222222222222',
  agentId: null,
  prompt: 'Do it',
  model: 'composer-2.5',
  status: 'queued',
  review: false,
  attempt: 1,
  maxTokens: null,
  maxSeconds: null,
  runId: null,
  error: null,
  createdAt: '2026-11-21T10:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  ...extra,
});

describe('taskActivity', () => {
  it('turns tasks into launched, started and ended entries, newest first', () => {
    const items = taskActivity([
      task('a', {
        status: 'finished',
        startedAt: '2026-11-21T10:00:05.000Z',
        finishedAt: '2026-11-21T10:01:00.000Z',
        runId: 'run-1',
      }),
      task('b', { createdAt: '2026-11-21T10:30:00.000Z' }),
    ]);
    expect(items.map((item) => [item.taskId, item.kind])).toEqual([
      ['b', 'launched'],
      ['a', 'finished'],
      ['a', 'started'],
      ['a', 'launched'],
    ]);
    expect(items[1]?.runId).toBe('run-1');
  });

  it('carries the reason a task failed, and shortens a long prompt', () => {
    const [item] = taskActivity([
      task('c', {
        status: 'failed',
        error: 'The repository cannot be reached.',
        finishedAt: '2026-11-21T11:00:00.000Z',
        prompt: 'x'.repeat(300),
      }),
    ]);
    expect(item).toMatchObject({ kind: 'failed', detail: 'The repository cannot be reached.' });
    expect(item?.prompt).toHaveLength(118);
  });

  it('does not report a task that is still running as ended, and honours the limit', () => {
    const running = task('d', { status: 'running', startedAt: '2026-11-21T10:00:05.000Z' });
    expect(taskActivity([running]).map((item) => item.kind)).toEqual(['started', 'launched']);
    expect(taskActivity([running], 1)).toHaveLength(1);
  });
});
