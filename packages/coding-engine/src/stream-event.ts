import type { SDKMessage } from '@cursor/sdk';

export function summarizeCursorEvent(event: SDKMessage) {
  const envelope = {
    type: event.type,
    agentId: event.agent_id,
    runId: event.run_id,
  };

  if (event.type === 'tool_call') {
    return { ...envelope, name: event.name, status: event.status };
  }
  if (event.type === 'status') {
    return { ...envelope, status: event.status };
  }
  return envelope;
}

export type CursorStreamEvent = ReturnType<typeof summarizeCursorEvent>;
