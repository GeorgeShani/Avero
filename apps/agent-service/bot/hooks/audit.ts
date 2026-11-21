import { defineHook } from '@grok/agent-sdk/hooks';

/**
 * Writes one JSON line per finished or failed turn: which agent, which session, how many tokens.
 * A hook only observes, so this records what happened; it cannot stop anything. (Stopping a risky
 * shell command is done by the worker's command guard, a Cursor hook written into each working
 * copy.) Nothing from the conversation itself is logged, only identifiers and counts.
 */
export default defineHook({
  events: {
    async 'turn.completed'(event, ctx) {
      if (ctx.session.purpose === 'eval') return;
      process.stdout.write(
        `${JSON.stringify({
          event: 'agent.turn_completed',
          agent: ctx.agent.name,
          session: ctx.session.id,
          totalTokens: event.data.usage
            ? event.data.usage.inputTokens + event.data.usage.outputTokens
            : null,
          at: event.at,
        })}\n`,
      );
    },
    async 'turn.failed'(event, ctx) {
      if (ctx.session.purpose === 'eval') return;
      process.stderr.write(
        `${JSON.stringify({
          event: 'agent.turn_failed',
          agent: ctx.agent.name,
          session: ctx.session.id,
          status: event.data.status ?? null,
          code: event.data.code ?? null,
          at: event.at,
        })}\n`,
      );
    },
  },
});
