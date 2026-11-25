import type { HostedState } from '../console-shell/hosted';
import type { WorkspaceSummary } from './workspace-summary';

/**
 * done: finished. next: the one to do now. later: waits for an earlier step. blocked: cannot be done
 * by the person, because the server is not set up for it.
 */
export type StepState = 'done' | 'next' | 'later' | 'blocked';

export type SetupStep = {
  id: string;
  title: string;
  /** One or two plain sentences: why it matters and what to do. */
  detail: string;
  state: StepState;
  optional?: true;
  /** A command to run in a terminal. */
  command?: string;
  /** A page that does it. */
  href?: string;
  hrefLabel?: string;
};

export type SetupInput = {
  /** Runs recorded on this machine, runs a reviewer has rated, runs a person decided on. */
  runs: { total: number; reviewed: number; decided: number; firstRunId?: string };
  suites: number;
  /** Whether this server can see a Cursor key. The command line reads the key from its own shell. */
  cursorKey: boolean;
  hosted: HostedState;
  /** The selected workspace's counts, when someone is signed in to one. */
  workspace?: WorkspaceSummary;
};

type Draft = Omit<SetupStep, 'state'> & { done: boolean; blocked?: true };

/** The first step not done is the next one; the rest wait. A blocked step stays blocked. */
function order(drafts: Draft[]): SetupStep[] {
  let nextTaken = false;
  return drafts.map(({ done, blocked, ...step }): SetupStep => {
    if (done) return { ...step, state: 'done' };
    if (blocked) return { ...step, state: 'blocked' };
    if (!nextTaken && !step.optional) {
      nextTaken = true;
      return { ...step, state: 'next' };
    }
    return { ...step, state: 'later' };
  });
}

/** Recording and reviewing runs on this machine. Needs nothing but the command line. */
export function localSteps(input: SetupInput): SetupStep[] {
  const runId = input.runs.firstRunId ?? '<run-id>';
  return order([
    {
      id: 'key',
      title: 'Have a Cursor API key ready',
      detail: input.cursorKey
        ? 'This server can see one. The command line reads the key from the terminal you run it in.'
        : 'Agent runs use your Cursor key. Set CURSOR_API_KEY in the terminal you run Avero from. This page cannot see your terminal, so it may be set even though it says not found.',
      done: input.cursorKey || input.runs.total > 0,
    },
    {
      id: 'record',
      title: 'Record a run',
      detail:
        'An agent works on a folder you point it at, and Avero saves everything it did so you can replay it.',
      command: 'pnpm avero run "fix the flaky retry test" --cwd <your repository>',
      done: input.runs.total > 0,
    },
    {
      id: 'review',
      title: 'Get an independent review',
      detail:
        'A second agent reads the task and the diff and rates the risk. Avero checks what it claims against the record.',
      command: `pnpm avero verdict ${runId}`,
      done: input.runs.reviewed > 0,
    },
    {
      id: 'decide',
      title: 'Decide: approve, ask for changes or reject',
      detail: 'The review is advice. You make the call, and it is saved with the run.',
      href: '/review',
      hrefLabel: 'Open Review',
      done: input.runs.decided > 0,
    },
    {
      id: 'evaluate',
      title: 'Compare setups on your own history',
      detail:
        'Optional. Build tasks from your repository’s past commits, then see which model and rules resolve the most for the least.',
      command: 'pnpm avero bench init --repo . --test "npm test"',
      optional: true,
      done: input.suites > 0,
    },
  ]);
}

/**
 * Running agents for a team from the browser. Empty when the server has no sign-in or database,
 * because there is nothing the person can do about that from here.
 */
export function workspaceSteps(input: SetupInput): SetupStep[] {
  const { hosted, workspace } = input;
  if (hosted.status === 'unavailable') {
    return [
      {
        id: 'server',
        title: 'Team workspace is not set up on this server',
        detail:
          'It needs sign-in (Clerk) and a database (PostgreSQL). Whoever runs this server can set them up; Settings lists what is missing.',
        href: '/settings#setup',
        hrefLabel: 'See what is missing',
        state: 'blocked',
      },
    ];
  }

  const signedIn = hosted.status === 'signed-in';
  const hasWorkspace = signedIn && hosted.workspaces.length > 0;
  return order([
    {
      id: 'sign-in',
      title: 'Sign in',
      detail: 'A workspace belongs to your account.',
      href: '/sign-in',
      hrefLabel: 'Sign in',
      done: signedIn,
    },
    {
      id: 'workspace',
      title: 'Create a workspace',
      detail: 'It holds a team’s repositories, agents and tasks.',
      href: '/workspaces',
      hrefLabel: 'Open Workspaces',
      done: hasWorkspace,
    },
    {
      id: 'repository',
      title: 'Add a repository',
      detail: 'Tasks run on a throwaway copy of it. The repository itself is never touched.',
      href: '/repositories',
      hrefLabel: 'Open Repositories',
      done: (workspace?.repositories ?? 0) > 0,
    },
    {
      id: 'agent',
      title: 'Create an agent',
      detail: 'Optional. A model and rules to launch tasks with, instead of the server’s defaults.',
      href: '/agents',
      hrefLabel: 'Open Agents',
      optional: true,
      done: (workspace?.agents ?? 0) > 0,
    },
    {
      id: 'task',
      title: 'Launch a task',
      detail:
        'Describe what the agent should do and watch it work. A worker runs it, not your browser.',
      href: '/tasks',
      hrefLabel: 'Open Tasks',
      done: (workspace?.tasks.total ?? 0) > 0,
    },
    {
      id: 'result',
      title: 'Open a finished run',
      detail: 'Replay what the agent did, read the diff and decide.',
      href: '/tasks',
      hrefLabel: 'Open Tasks',
      done: (workspace?.tasks.finished ?? 0) > 0,
    },
  ]);
}

/** The step to do now on each track, or undefined when that track is finished. */
export function nextStep(steps: readonly SetupStep[]): SetupStep | undefined {
  return steps.find((step) => step.state === 'next');
}

/** True when every step that is not optional is done. A blocked step does not count as done. */
export function isComplete(steps: readonly SetupStep[]): boolean {
  return steps.every((step) => step.state === 'done' || step.optional === true);
}
