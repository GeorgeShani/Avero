import { afterEach, describe, expect, it, vi } from 'vitest';
import toolErrors from '../bot/hooks/tool-errors.ts';

type Handler = (event: unknown, ctx: unknown) => Promise<void>;
const handler = (toolErrors as unknown as { events: Record<string, Handler> }).events[
  'action.result'
] as Handler;

const context = (purpose: 'live' | 'eval') => ({
  session: { id: 's1', purpose },
  agent: { name: 'avero-review' },
});
const result = (isError: boolean) => ({
  at: '2026-11-21T10:00:00.000Z',
  data: { callId: 'c1', toolName: 'scan_secrets', isError, output: 'a secret path /home/x' },
});

afterEach(() => vi.restoreAllMocks());

describe('tool-errors hook', () => {
  it('logs which tool failed, and nothing from its arguments or output', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    await handler(result(true), context('live'));
    expect(write).toHaveBeenCalledOnce();
    const line = String(write.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({ event: 'agent.tool_failed', tool: 'scan_secrets' });
    expect(line).not.toContain('/home/x');
  });

  it('stays quiet for successful calls and for evals', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    await handler(result(false), context('live'));
    await handler(result(true), context('eval'));
    expect(write).not.toHaveBeenCalled();
  });
});
