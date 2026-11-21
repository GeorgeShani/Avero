import { defineAgent } from '@grok/agent-sdk';

export default defineAgent({
  description:
    'Works out what happened in a recorded agent run: where it first went wrong, whether tests ran, whether it stayed in scope, and how it ended. Use it when asked why a run failed, stalled or cost too much. It cannot change anything or re-run it.',
});
