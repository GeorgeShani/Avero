import { describe, expect, it } from 'vitest';
import { lifecyclePolicy, outcomeFor } from './policy.ts';

describe('lifecycle policy', () => {
  it('treats a task as lost only well after a few missed heartbeats', () => {
    expect(lifecyclePolicy.staleAfterMs).toBeGreaterThanOrEqual(lifecyclePolicy.heartbeatMs * 5);
    expect(lifecyclePolicy.maxAttempts).toBeGreaterThanOrEqual(1);
  });
});

describe('outcomeFor', () => {
  it('finishes a run that finished', () => {
    expect(outcomeFor({ status: 'FINISHED' }, false)).toEqual({ status: 'finished' });
  });

  it('keeps a finished run finished even if a stop was requested too late', () => {
    expect(outcomeFor({ status: 'FINISHED' }, true)).toEqual({ status: 'finished' });
  });

  it('cancels a task whose run stopped because someone asked', () => {
    expect(outcomeFor({ status: 'CANCELLED' }, true)).toEqual({ status: 'cancelled' });
    expect(outcomeFor({ status: 'ERROR' }, true)).toEqual({ status: 'cancelled' });
  });

  it('fails, with a reason, a run that was cut off by a limit or errored on its own', () => {
    expect(outcomeFor({ status: 'CANCELLED' }, false)).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('limit'),
    });
    expect(outcomeFor({ status: 'ERROR', error: 'boom' }, false)).toEqual({
      status: 'failed',
      error: 'boom',
    });
    expect(outcomeFor({ status: 'EXPIRED' }, false).status).toBe('failed');
  });
});
