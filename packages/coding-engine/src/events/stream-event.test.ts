import { describe, expect, it } from 'vitest';
import { summarizeCursorEvent } from './stream-event.ts';

describe('Cursor SDK event output', () => {
  it('keeps tool lifecycle metadata and omits arguments and results', () => {
    const summary = summarizeCursorEvent({
      type: 'tool_call',
      agent_id: 'agent-1',
      run_id: 'run-1',
      call_id: 'call-1',
      name: 'read',
      status: 'completed',
      args: { path: 'private-file.ts' },
      result: { text: 'private content' },
    });

    expect(summary).toEqual({
      type: 'tool_call',
      agentId: 'agent-1',
      runId: 'run-1',
      name: 'read',
      status: 'completed',
    });
  });
});
