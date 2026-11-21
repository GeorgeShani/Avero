import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeLog } from './index.ts';

afterEach(() => vi.restoreAllMocks());

describe('writeLog', () => {
  it('writes info events to stdout as one JSON line', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    writeLog('info', 'workspace.created', { workspaceId: 'w1' });

    expect(stderr).not.toHaveBeenCalled();
    const line = String(stdout.mock.calls[0]?.[0]);
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toMatchObject({
      level: 'info',
      event: 'workspace.created',
      workspaceId: 'w1',
    });
  });

  it('writes error events to stderr', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    writeLog('error', 'workspace.list_failed');

    expect(stdout).not.toHaveBeenCalled();
    expect(JSON.parse(String(stderr.mock.calls[0]?.[0]))).toMatchObject({
      level: 'error',
      event: 'workspace.list_failed',
    });
  });

  it('keeps level and event authoritative over caller details', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    writeLog('info', 'real.event', { level: 'error', event: 'spoofed' } as never);

    expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
      level: 'info',
      event: 'real.event',
    });
  });

  it('stamps an ISO timestamp', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    writeLog('info', 'tick');
    const { at } = JSON.parse(String(stdout.mock.calls[0]?.[0])) as { at: string };
    expect(new Date(at).toISOString()).toBe(at);
  });
});
