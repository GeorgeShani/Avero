import { defineAgent } from '@grok/agent-sdk';

export default defineAgent({
  description:
    'Reviews a change or a recorded agent run against what was asked: checks each requirement against the diff, flags files outside the task and tests that were not run, and rates the risk. Use it when asked whether a change is safe to merge. It cannot approve or modify anything.',
});
