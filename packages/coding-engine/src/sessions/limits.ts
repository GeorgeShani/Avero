import type { TokenUsage } from '@avero/contracts';

/** Caps that stop a run: a person sets them so an agent cannot spend without bound. */
export type RunLimits = {
  /** Stop once the run has used this many tokens in total. */
  maxTokens?: number;
  /** Stop once the run has been going this many seconds. */
  maxSeconds?: number;
};

/** The reason a run has gone over a cap, or undefined while it is within them. */
export function limitReason(
  limits: RunLimits | undefined,
  used: { tokens: number; elapsedMs: number },
): string | undefined {
  if (!limits) return undefined;
  if (limits.maxTokens !== undefined && used.tokens >= limits.maxTokens) {
    return `Token cap reached: ${used.tokens.toLocaleString('en-US')} tokens used, the cap is ${limits.maxTokens.toLocaleString('en-US')}.`;
  }
  if (limits.maxSeconds !== undefined && used.elapsedMs >= limits.maxSeconds * 1000) {
    return `Time cap reached: ${(used.elapsedMs / 1000).toFixed(1)} s elapsed, the cap is ${limits.maxSeconds} s.`;
  }
  return undefined;
}

/** Adds up the usage of several turns, such as a planning turn and the turn that carries it out. */
export function sumUsage(usages: readonly (TokenUsage | undefined)[]): TokenUsage | undefined {
  const present = usages.filter((usage): usage is TokenUsage => usage !== undefined);
  if (present.length === 0) return undefined;
  const total = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
  };
  let reasoning: number | undefined;
  for (const usage of present) {
    total.inputTokens += usage.inputTokens;
    total.outputTokens += usage.outputTokens;
    total.cacheReadTokens += usage.cacheReadTokens;
    total.cacheWriteTokens += usage.cacheWriteTokens;
    total.totalTokens += usage.totalTokens;
    if (usage.reasoningTokens !== undefined) reasoning = (reasoning ?? 0) + usage.reasoningTokens;
  }
  return reasoning === undefined ? total : { ...total, reasoningTokens: reasoning };
}
