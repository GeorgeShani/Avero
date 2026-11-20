import type { SDKMessage } from '@cursor/sdk';
import { describe, expect, it } from 'vitest';
import { eventsFor } from './recorder.ts';

const ids = { agent_id: 'agent-1', run_id: 'run-1' };

describe('eventsFor', () => {
  it('keeps the text of an assistant message and drops its tool_use blocks', () => {
    const message: SDKMessage = {
      type: 'assistant',
      ...ids,
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Reading the file.' },
          { type: 'tool_use', id: 't1', name: 'read', input: { path: 'a.ts' } },
        ],
      },
    };
    expect(eventsFor(message)).toEqual([{ type: 'assistant', text: 'Reading the file.' }]);
  });

  it('records a tool call with its arguments and result', () => {
    const message: SDKMessage = {
      type: 'tool_call',
      ...ids,
      call_id: 'c1',
      name: 'read',
      status: 'completed',
      args: { path: 'a.ts' },
      result: 'contents',
    };
    expect(eventsFor(message)).toEqual([
      {
        type: 'tool',
        callId: 'c1',
        name: 'read',
        status: 'completed',
        args: { path: 'a.ts' },
        result: 'contents',
      },
    ]);
  });

  it('cuts an oversized result and says so', () => {
    const message: SDKMessage = {
      type: 'tool_call',
      ...ids,
      call_id: 'c2',
      name: 'shell',
      status: 'completed',
      result: 'x'.repeat(20_000),
    };
    const [event] = eventsFor(message) as [{ result: string; truncated: { result: boolean } }];
    expect(event.result.length).toBeLessThan(8_100);
    expect(event.truncated).toEqual({ result: true });
  });

  it('passes status and usage through, and ignores messages it has no use for', () => {
    expect(eventsFor({ type: 'status', ...ids, status: 'RUNNING' })).toEqual([
      { type: 'status', status: 'RUNNING' },
    ]);
    const usage = {
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 3,
    };
    expect(eventsFor({ type: 'usage', ...ids, usage })).toEqual([{ type: 'usage', usage }]);
    expect(eventsFor({ type: 'request', ...ids, request_id: 'r' })).toEqual([]);
    expect(eventsFor({ type: 'user', ...ids, message: { role: 'user', content: [] } })).toEqual([]);
  });
});
