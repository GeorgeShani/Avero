import { toolSpans } from '@avero/contracts';
import type { AgentStep } from '@avero/ui';
import { exampleRecord } from './example';
import { cheapestSetup, setups } from './bench-data';

/** One move of the scripted agent: say what it intends, find the control, call the action. */
export type Stage = {
  say: string;
  /** Part of the control's name, used to bring it into view before the action. */
  focus: string;
  steps: AgentStep[];
  /** Milliseconds to wait afterwards so the page can react. */
  wait?: number;
};

export type Task = {
  id: string;
  label: string;
  stages: readonly Stage[];
};

const setValue = (ref: string, value: unknown): AgentStep => ({
  ref,
  action: 'setValue',
  args: [value],
});

const best = cheapestSetup()?.label ?? setups[0]?.label ?? '';

/** Where the real recording first runs a shell command, in milliseconds. */
export const shellStartMs = Math.round(
  toolSpans(exampleRecord).find((span) => span.kind === 'shell')?.start ?? 0,
);

/**
 * The scripted agent has no model. Each task is a fixed list of the calls a real agent would make
 * through the same three tools (snapshot, act and query).
 */
export const tasks: readonly Task[] = [
  {
    id: 'replay',
    label: 'Replay the test run',
    stages: [
      {
        say: 'Speed the replay up to 16x.',
        focus: 'Speed',
        steps: [setValue('Speed', '16x')],
      },
      {
        say: `Jump the playhead to the first shell command, at ${(shellStartMs / 1000).toFixed(1)} seconds.`,
        focus: 'Playhead',
        steps: [setValue('Playhead', shellStartMs)],
        wait: 900,
      },
    ],
  },
  {
    id: 'review',
    label: 'Run the reviewer',
    stages: [
      {
        say: 'Pick the run that was cut off at a time cap.',
        focus: 'Run',
        steps: [setValue('Run', 'Cancelled run')],
        wait: 400,
      },
      {
        say: 'Switch the independent reviewer on and let it finish.',
        focus: 'Independent reviewer',
        steps: [setValue('Independent reviewer', 'On')],
        wait: 3900,
      },
      {
        say: 'A check failed. Try to approve the change anyway.',
        focus: 'Approve anyway',
        steps: [{ ref: 'Approve anyway', action: 'press' }],
      },
    ],
  },
  {
    id: 'bench',
    label: 'Find the cheapest setup',
    stages: [
      ...setups.map((setup): Stage => ({
        say: `Look at the setup with ${setup.label.toLowerCase()}.`,
        focus: 'Setup',
        steps: [setValue('Setup', setup.label)],
        wait: 800,
      })),
      {
        say: `${best} spent the fewest tokens per resolved task, though the gap is too small to trust. Settle there.`,
        focus: 'Setup',
        steps: [setValue('Setup', best)],
        wait: 800,
      },
    ],
  },
];
