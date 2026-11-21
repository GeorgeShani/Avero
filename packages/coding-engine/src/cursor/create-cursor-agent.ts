import { Agent } from '@cursor/sdk';
import type { AgentLike, CreateAgent } from '../adapters/agent-port.ts';

/** The real SDK. Its types are wider than the slice above, so this is the one place they meet. */
export const createCursorAgent: CreateAgent = async (options) =>
  (await Agent.create(options)) as unknown as AgentLike;
