import { beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceSession = vi.hoisted(() => vi.fn());
vi.mock('./workspaces', () => ({ workspaceSession }));

import { readWorkspaceInput, workspaceApiSession, workspaceJson } from './workspace-api';

function jsonRequest(body: BodyInit | null, contentType = 'application/json') {
  return new Request('http://localhost/api/v1/workspaces', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

beforeEach(() => workspaceSession.mockReset());

describe('workspaceJson', () => {
  it('never lets shared caches store workspace responses', async () => {
    const response = workspaceJson({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe('workspaceApiSession', () => {
  it('answers 503 when Clerk or the database is not configured', async () => {
    workspaceSession.mockResolvedValue({ status: 'unavailable' });
    const result = await workspaceApiSession();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(503);
  });

  it('answers 401 when signed out', async () => {
    workspaceSession.mockResolvedValue({ status: 'signed-out' });
    const result = await workspaceApiSession();
    expect((result as Response).status).toBe(401);
  });

  it('returns the session when signed in', async () => {
    workspaceSession.mockResolvedValue({ status: 'signed-in', userId: 'user_1' });
    await expect(workspaceApiSession()).resolves.toEqual({ status: 'signed-in', userId: 'user_1' });
  });
});

describe('readWorkspaceInput', () => {
  it('rejects non-JSON bodies with 415', async () => {
    const result = await readWorkspaceInput(jsonRequest('name=x', 'text/plain'));
    expect((result as Response).status).toBe(415);
  });

  it('accepts a JSON content type with a charset parameter', async () => {
    const result = await readWorkspaceInput(
      jsonRequest(JSON.stringify({ name: 'Platform' }), 'application/json; charset=utf-8'),
    );
    expect(result).toEqual({ name: 'Platform' });
  });

  it('trims the name', async () => {
    await expect(
      readWorkspaceInput(jsonRequest(JSON.stringify({ name: '  Platform  ' }))),
    ).resolves.toEqual({ name: 'Platform' });
  });

  it.each([
    ['malformed JSON', '{nope'],
    ['an empty name', JSON.stringify({ name: '   ' })],
    ['a name over 80 characters', JSON.stringify({ name: 'x'.repeat(81) })],
    ['extra fields', JSON.stringify({ name: 'ok', role: 'owner' })],
    ['a non-object body', JSON.stringify('ok')],
  ])('answers 400 for %s', async (_label, body) => {
    const result = await readWorkspaceInput(jsonRequest(body));
    expect((result as Response).status).toBe(400);
  });
});
