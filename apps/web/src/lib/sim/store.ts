import type { TaskStatus } from '@avero/ui';

/**
 * A client-side simulation of agent runs. Repository connections, the task API and the worker
 * do not exist yet (Milestones 3 and 4), so this store is the only source of run data in the
 * console. Every screen that reads it says so. Replace it with real queries as they land.
 */

export type SimEventKind = 'message' | 'tool' | 'files' | 'tests' | 'approval' | 'error' | 'result';

export type SimEvent = { id: string; tick: number; kind: SimEventKind; text: string };

export type Effort = 'low' | 'medium' | 'high' | 'max';

export type SimTask = {
  id: string;
  title: string;
  repo: string;
  agent: string;
  mode: 'Cloud' | 'Local';
  effort: Effort;
  status: TaskStatus;
  progress: number;
  startedTick: number;
  endedTick: number | null;
  step: number;
  willFail: boolean;
  events: SimEvent[];
  pullRequest: string | null;
};

type Step = { kind: SimEventKind; text: string; gate?: 'approval' };

const beforeApproval: Step[] = [
  { kind: 'message', text: 'Reading the repository and the task description' },
  { kind: 'tool', text: 'assess_change returned: dependency or workflow review required' },
  { kind: 'files', text: 'Edited 2 files' },
  { kind: 'tests', text: 'Ran 14 tests: 14 passed' },
  { kind: 'approval', text: 'Approval requested to open a pull request', gate: 'approval' },
];

const afterApproval: Step[] = [
  { kind: 'message', text: 'Opening the pull request' },
  { kind: 'result', text: 'Pull request opened' },
];

export const tickMs = 1400;

export type SimState = {
  tick: number;
  nextTask: number;
  tasks: readonly SimTask[];
  activity: readonly number[];
};

export type NewTask = {
  title: string;
  repo: string;
  agent: string;
  mode: 'Cloud' | 'Local';
  effort: Effort;
};

function seedTask(
  id: string,
  title: string,
  repo: string,
  agent: string,
  status: TaskStatus,
  step: number,
  extras: Partial<SimTask> = {},
): SimTask {
  const lines = beforeApproval.slice(0, step);
  return {
    id,
    title,
    repo,
    agent,
    mode: 'Cloud',
    effort: 'medium',
    status,
    progress: Math.round((step / (beforeApproval.length + afterApproval.length)) * 100),
    startedTick: 0,
    endedTick: null,
    step,
    willFail: false,
    events: lines.map((line, index) => ({
      id: `${id}:${index}`,
      tick: index,
      kind: line.kind,
      text: line.text,
    })),
    pullRequest: null,
    ...extras,
  };
}

export function createInitialState(): SimState {
  const done = [...beforeApproval, ...afterApproval];
  return {
    tick: 8,
    nextTask: 1043,
    activity: [2, 3, 1, 4, 3, 2, 5, 4, 3, 2, 4, 3],
    tasks: [
      seedTask(
        'task-1042',
        'Retry failed webhook deliveries with backoff',
        'sample/worker',
        'Engineering Coordinator',
        'running',
        2,
      ),
      seedTask(
        'task-1041',
        'Review pull request: workspace rename endpoint',
        'sample/web',
        'Pull Request Reviewer',
        'awaiting-approval',
        5,
      ),
      seedTask(
        'task-1040',
        'Add unit tests for repository slug validation',
        'sample/github',
        'Testing Agent',
        'completed',
        done.length,
        {
          endedTick: 7,
          progress: 100,
          pullRequest: '#317',
          events: done.map((line, index) => ({
            id: `task-1040:${index}`,
            tick: index,
            kind: line.kind,
            text: line.text,
          })),
        },
      ),
      seedTask(
        'task-1039',
        'Investigate flaky db migration test',
        'sample/db',
        'Issue Triage Agent',
        'failed',
        3,
        {
          mode: 'Local',
          endedTick: 5,
          events: [
            {
              id: 'task-1039:0',
              tick: 0,
              kind: 'message',
              text: 'Reading the repository and the task description',
            },
            {
              id: 'task-1039:1',
              tick: 1,
              kind: 'tool',
              text: 'assess_change returned: dependency or workflow review required',
            },
            { id: 'task-1039:2', tick: 2, kind: 'error', text: 'Tests failed: timeout after 30s' },
          ],
        },
      ),
      seedTask(
        'task-1038',
        'Document the worker health endpoint',
        'sample/worker',
        'Documentation Agent',
        'queued',
        0,
        {
          startedTick: 8,
          progress: 0,
        },
      ),
    ],
  };
}

function withEvent(task: SimTask, state: SimState, kind: SimEventKind, text: string): SimTask {
  return {
    ...task,
    events: [
      ...task.events,
      { id: `${task.id}:${task.events.length}`, tick: state.tick, kind, text },
    ],
  };
}

/** Advances every active task by one step. Returns a new state; the input is not mutated. */
export function advance(previous: SimState): SimState {
  const state: SimState = { ...previous, tick: previous.tick + 1 };
  let produced = 0;
  const total = beforeApproval.length + afterApproval.length;

  const tasks = previous.tasks.map((original) => {
    let task = original;
    if (task.status === 'queued') {
      return state.tick - task.startedTick >= 2 ? { ...task, status: 'preparing' as const } : task;
    }
    if (task.status === 'preparing') return { ...task, status: 'running' as const };
    if (task.status !== 'running') return task;

    const resumed = task.step >= beforeApproval.length;
    const script = resumed ? afterApproval : beforeApproval;
    const line = script[resumed ? task.step - beforeApproval.length : task.step];
    if (!line) return task;

    if (task.willFail && line.kind === 'tests') {
      produced += 1;
      task = withEvent(task, state, 'error', 'Tests failed: 2 of 14 failed');
      return {
        ...task,
        status: 'failed' as const,
        endedTick: state.tick,
        progress: Math.round(((task.step + 1) / total) * 100),
      };
    }

    produced += 1;
    const step = task.step + 1;
    task = withEvent(task, state, line.kind, line.text);
    task = { ...task, step, progress: Math.round((step / total) * 100) };
    if (line.gate === 'approval') return { ...task, status: 'awaiting-approval' as const };
    if (step === total) {
      return {
        ...task,
        status: 'completed' as const,
        endedTick: state.tick,
        progress: 100,
        pullRequest: `#${320 + (state.tick % 40)}`,
      };
    }
    return task;
  });

  return { ...state, tasks, activity: [...previous.activity.slice(1), produced] };
}

export function launch(state: SimState, input: NewTask): { state: SimState; id: string } {
  const id = `task-${state.nextTask}`;
  const task: SimTask = {
    id,
    title: input.title,
    repo: input.repo,
    agent: input.agent,
    mode: input.mode,
    effort: input.effort,
    status: 'queued',
    progress: 0,
    startedTick: state.tick,
    endedTick: null,
    step: 0,
    willFail: /flaky|fail/i.test(input.title),
    events: [],
    pullRequest: null,
  };
  return { state: { ...state, nextTask: state.nextTask + 1, tasks: [task, ...state.tasks] }, id };
}

function update(
  state: SimState,
  id: string,
  change: (task: SimTask, state: SimState) => SimTask,
): SimState {
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === id ? change(task, state) : task)),
  };
}

export function approve(state: SimState, id: string): SimState {
  return update(state, id, (task, current) =>
    task.status === 'awaiting-approval'
      ? withEvent({ ...task, status: 'running' }, current, 'message', 'Approved by you')
      : task,
  );
}

export function reject(state: SimState, id: string): SimState {
  return update(state, id, (task, current) =>
    task.status === 'awaiting-approval'
      ? {
          ...withEvent(task, current, 'error', 'Rejected by you'),
          status: 'cancelled',
          endedTick: current.tick,
        }
      : task,
  );
}

export function cancel(state: SimState, id: string): SimState {
  return update(state, id, (task, current) =>
    ['queued', 'preparing', 'running', 'awaiting-approval'].includes(task.status)
      ? {
          ...withEvent(task, current, 'message', 'Cancelled by you'),
          status: 'cancelled',
          endedTick: current.tick,
        }
      : task,
  );
}

export function retry(state: SimState, id: string): SimState {
  return update(state, id, (task, current) =>
    task.status === 'failed' || task.status === 'cancelled'
      ? {
          ...withEvent(task, current, 'message', 'Retry requested'),
          status: 'queued',
          step: 0,
          progress: 0,
          willFail: false,
          endedTick: null,
          startedTick: current.tick,
        }
      : task,
  );
}

export function elapsed(task: SimTask, tick: number): string {
  const end = task.endedTick ?? tick;
  const seconds = Math.max(0, Math.round(((end - task.startedTick) * tickMs) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function eventTime(event: SimEvent): string {
  const seconds = Math.round((event.tick * tickMs) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export const activeStates: readonly TaskStatus[] = [
  'queued',
  'preparing',
  'running',
  'awaiting-approval',
];
