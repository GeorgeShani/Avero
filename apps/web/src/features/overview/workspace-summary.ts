import type { Agent, Repository, RunListItem, Task } from '@avero/contracts';
import { isTerminal } from '@avero/contracts';
import { awaitingDecision } from '../review/queue';

/** What a workspace holds, counted from its own records. Nothing here is estimated. */
export type WorkspaceSummary = {
  repositories: number;
  agents: number;
  tasks: { total: number; active: number; queued: number; finished: number; failed: number };
  /** Finished runs of this workspace that nobody has decided on. */
  toDecide: number;
  /** Of those, the ones the reviewer rated medium or high. */
  risky: number;
};

export function summarizeWorkspace(input: {
  repositories: readonly Repository[];
  agents: readonly Agent[];
  tasks: readonly Task[];
  runs: readonly RunListItem[];
}): WorkspaceSummary {
  const waiting = awaitingDecision(input.runs);
  return {
    repositories: input.repositories.length,
    agents: input.agents.length,
    tasks: {
      total: input.tasks.length,
      active: input.tasks.filter((task) => !isTerminal(task.status)).length,
      queued: input.tasks.filter((task) => task.status === 'queued').length,
      finished: input.tasks.filter((task) => task.status === 'finished').length,
      failed: input.tasks.filter((task) => task.status === 'failed').length,
    },
    toDecide: waiting.length,
    risky: waiting.filter((run) => run.review.risk === 'medium' || run.review.risk === 'high')
      .length,
  };
}
