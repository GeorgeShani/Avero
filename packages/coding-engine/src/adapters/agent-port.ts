import type { AgentOptions, SDKMessage } from '@cursor/sdk';
import type { TokenUsage } from '@avero/contracts';

/**
 * The slice of the Cursor SDK that Avero uses. Code that runs agents takes a `CreateAgent`, so
 * tests can pass a fake and the real SDK is only touched in one place.
 */
export type AgentRunLike = {
  stream(): AsyncGenerator<SDKMessage, void>;
  wait(): Promise<{
    status: 'finished' | 'error' | 'cancelled';
    result?: string;
    error?: { message: string };
    usage?: TokenUsage;
  }>;
  cancel(): Promise<void>;
};

export type AgentLike = {
  send(prompt: string, options?: { mode?: 'agent' | 'plan' }): Promise<AgentRunLike>;
  getUsage(): Promise<{
    usage: TokenUsage;
    cost?: { rawCostCents: number; chargedCents: number };
  }>;
  [Symbol.asyncDispose]: () => PromiseLike<void>;
};

export type CreateAgent = (options: AgentOptions) => Promise<AgentLike>;
