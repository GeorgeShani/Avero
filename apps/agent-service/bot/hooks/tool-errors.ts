import { defineHook } from '@grok/agent-sdk/hooks';

/**
 * Writes one JSON line for each tool call that failed: which tool and which session, never the
 * arguments or the output, which can hold code or paths from the change under review. A failing
 * tool is the first thing to check when a review reads as vague.
 */
export default defineHook({
  events: {
    async 'action.result'(event, ctx) {
      if (ctx.session.purpose === 'eval' || !event.data.isError) return;
      process.stderr.write(
        `${JSON.stringify({
          event: 'agent.tool_failed',
          agent: ctx.agent.name,
          session: ctx.session.id,
          tool: event.data.toolName,
          at: event.at,
        })}\n`,
      );
    },
  },
});
