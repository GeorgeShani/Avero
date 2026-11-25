/**
 * The words the console uses that a newcomer will not know. One short sentence each, written for
 * someone who has never used Avero. Shown by `Term` wherever the word first appears on a page.
 */
export const glossary = {
  run: 'One recording of an agent doing a task: every command it ran, every file it changed and what it cost.',
  review:
    'A second agent reads the task and the diff and rates how risky the change is. It is advice, not approval.',
  decision:
    'Your call on a run: approve it, ask for changes, or reject it. It is saved with the run.',
  evaluation:
    'A test of which model and rules solve the most tasks for the least money, using your own repository’s history.',
  suite: 'The set of tasks an evaluation uses, built from your repository’s past commits.',
  setup: 'A model together with the rules it follows. Evaluations compare setups.',
  hillclimb:
    'An automatic search that improves a setup’s rules one measured change at a time, keeping only changes that score better.',
  resolved:
    'A task counts as resolved when the repository’s own tests pass after the agent’s change.',
  workspace: 'A shared space for a team: its repositories, agents and tasks. It needs sign-in.',
  agent: 'A saved setup for tasks: a model and the rules it follows.',
  worker: 'The process that actually runs a task. It runs on a server, never in your browser.',
} as const;

export type GlossaryKey = keyof typeof glossary;
