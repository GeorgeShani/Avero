import { defineAgent } from '@grok/agent-sdk';

/**
 * The review agent. It judges changes and recorded runs; it never makes them, so the built-in
 * tools (shell, edit, subagents…) are all switched off. `tools` only limits the built-in ones: the
 * agent's own tools in bot/tools/ (assess_change, summarize_diff, scan_secrets, check_tests) reach
 * it over MCP regardless, and so do the avero connection and the subagents in bot/subagents/.
 */
export default defineAgent({
  name: 'avero-review',
  description:
    'Assesses the review needs of a change and reviews recorded coding-agent runs against what was asked. Read-only: it cannot approve, merge or modify anything.',
  tools: [],
});
