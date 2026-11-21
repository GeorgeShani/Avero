/** The roadmap shown on the landing page. Keep it in step with docs/product-plan.md. */
export const phases = [
  {
    id: '0',
    name: 'Prove the SDKs',
    body: 'Authenticate, record one real local run, and run one Agent SDK eval. Draft the run-record schema.',
    state: 'Done',
  },
  {
    id: '1',
    name: 'Recorder and Scope',
    body: 'The avero run command, JSONL run records, and a replay viewer over real recordings.',
    state: 'Done',
  },
  {
    id: '2',
    name: 'Verdict and gates',
    body: 'An independent reviewer agent, the intent-versus-diff card, plan gates and budget caps.',
    state: 'Built',
  },
  {
    id: '3',
    name: 'Bench and hillclimb',
    body: 'Tasks mined from your repository history, a model-by-rules matrix, and cost per resolved task.',
    state: 'Built',
  },
  {
    id: '4',
    name: 'Share and launch',
    body: 'One-file HTML replays, Agent Trace output, an MCP server and an npx package. Not on npm yet.',
    state: 'Built',
  },
  {
    id: '5',
    name: 'Avero Cloud',
    body: 'Run sync, a launch board, a review queue, the GitHub App, cloud agents and Slack channels.',
    state: 'Planned',
  },
] as const;
