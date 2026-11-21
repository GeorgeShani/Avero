import { defineConnection } from '@grok/agent-sdk/connections';

/**
 * Avero's own read-only MCP server (`avero mcp`): list recorded runs, read a run, its events, its
 * verdict and its changes, and search them. It never writes. Needs the `avero` command on the
 * PATH of the machine running the agent, and AVERO_RUNS_DIR pointing at the runs to read.
 */
export default defineConnection({
  command: 'avero',
  args: ['mcp'],
  env: { AVERO_RUNS_DIR: '${AVERO_RUNS_DIR}' },
});
