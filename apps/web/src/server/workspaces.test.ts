import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ auth, currentUser: vi.fn() }));

import { canEditWorkspace, databaseConfigured, workspaceSession } from './workspaces';

const configured = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc123',
  CLERK_SECRET_KEY: 'sk_test_abc123',
  DATABASE_URL: 'postgres://avero:avero@localhost:5432/avero',
};

function stubEnvironment(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

beforeEach(() => auth.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe('workspaceSession', () => {
  it('is unavailable without Clerk keys', async () => {
    stubEnvironment({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
      CLERK_SECRET_KEY: undefined,
      DATABASE_URL: configured.DATABASE_URL,
    });
    await expect(workspaceSession()).resolves.toEqual({ status: 'unavailable' });
    expect(auth).not.toHaveBeenCalled();
  });

  it('is unavailable without a Postgres URL', async () => {
    stubEnvironment({ ...configured, DATABASE_URL: undefined });
    expect(databaseConfigured()).toBe(false);
    await expect(workspaceSession()).resolves.toEqual({ status: 'unavailable' });
  });

  it('reports signed-out when Clerk has no user', async () => {
    stubEnvironment(configured);
    auth.mockResolvedValue({ userId: null });
    await expect(workspaceSession()).resolves.toEqual({ status: 'signed-out' });
  });

  it('reports the Clerk user id when signed in', async () => {
    stubEnvironment(configured);
    auth.mockResolvedValue({ userId: 'user_42' });
    await expect(workspaceSession()).resolves.toEqual({ status: 'signed-in', userId: 'user_42' });
  });
});

describe('canEditWorkspace', () => {
  it('is the shared security rule', () => {
    expect(canEditWorkspace('owner')).toBe(true);
    expect(canEditWorkspace('viewer')).toBe(false);
  });
});
