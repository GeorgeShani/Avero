import type { Repository, RunListItem, Task } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { summarizeWorkspace } from './workspace-summary';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function task(n: number, status: Task['status']): Task {
  return {
    id: id(n),
    repositoryId: id(900),
    agentId: null,
    prompt: 'do it',
    model: 'm',
    status,
    review: false,
    attempt: 1,
    maxTokens: null,
    maxSeconds: null,
    runId: null,
    error: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
  };
}

function run(runId: string, risk?: 'low' | 'high', decision?: 'approved'): RunListItem {
  return {
    runId,
    task: 't',
    model: 'm',
    startedAt: '2026-11-20T10:00:00.000Z',
    status: 'FINISHED',
    durationMs: 1,
    totalTokens: 1,
    costCents: null,
    toolCalls: 0,
    filesChanged: 0,
    additions: 0,
    deletions: 0,
    review: { ...(risk ? { risk, failedChecks: 0 } : {}), ...(decision ? { decision } : {}) },
  };
}

describe('summarizeWorkspace', () => {
  it('counts tasks by what they are doing', () => {
    const summary = summarizeWorkspace({
      repositories: [
        { id: id(1), name: 'r', kind: 'local', createdAt: '2026-11-20T10:00:00.000Z' },
      ],
      agents: [],
      tasks: [
        task(1, 'queued'),
        task(2, 'running'),
        task(3, 'finished'),
        task(4, 'failed'),
        task(5, 'cancelled'),
      ] as Task[],
      runs: [],
    });
    expect(summary.repositories).toBe(1);
    expect(summary.tasks).toEqual({ total: 5, active: 2, queued: 1, finished: 1, failed: 1 });
  });

  it('counts only finished runs without a decision, and how many are risky', () => {
    const summary = summarizeWorkspace({
      repositories: [] as Repository[],
      agents: [],
      tasks: [],
      runs: [run('a', 'high'), run('b', 'low'), run('c', 'high', 'approved'), run('d')],
    });
    expect(summary.toDecide).toBe(3);
    expect(summary.risky).toBe(1);
  });
});
