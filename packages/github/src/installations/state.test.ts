import { describe, expect, it } from 'vitest';
import { signInstallState, verifyInstallState } from './state.ts';

const secret = 'state-secret';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const now = 1_800_000_000_000;

describe('install state', () => {
  const state = signInstallState(secret, { workspaceId, userId: 'user_1', now: () => now });

  it('comes back as the workspace it was issued for, to the same person', () => {
    expect(verifyInstallState(secret, state, { userId: 'user_1', now: () => now + 1000 })).toEqual({
      workspaceId,
    });
  });

  it('is refused for another person, after ten minutes, and with another secret', () => {
    expect(verifyInstallState(secret, state, { userId: 'user_2', now: () => now })).toBeUndefined();
    expect(
      verifyInstallState(secret, state, { userId: 'user_1', now: () => now + 11 * 60_000 }),
    ).toBeUndefined();
    expect(
      verifyInstallState('other', state, { userId: 'user_1', now: () => now }),
    ).toBeUndefined();
    expect(verifyInstallState('', state, { userId: 'user_1', now: () => now })).toBeUndefined();
  });

  it('is refused when it was altered, truncated or never signed', () => {
    const [body, signature] = state.split('.') as [string, string];
    const forged = Buffer.from(
      JSON.stringify({ w: '22222222-2222-4222-8222-222222222222', u: 'user_1', exp: now + 60_000 }),
    ).toString('base64url');
    for (const bad of [
      `${forged}.${signature}`,
      `${body}.`,
      body,
      `${state}.x`,
      '',
      'a.b',
      `${body}.${'A'.repeat(43)}`,
    ]) {
      expect(verifyInstallState(secret, bad, { userId: 'user_1', now: () => now })).toBeUndefined();
    }
  });
});
