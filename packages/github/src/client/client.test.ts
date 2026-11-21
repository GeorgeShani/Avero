import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createAppJwt } from './app-auth.ts';
import { createGithubClient, GithubError } from './rest.ts';

describe('createAppJwt', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  it('is an RS256 token for the app that GitHub could verify', () => {
    const now = Date.UTC(2026, 10, 21, 12, 0, 0);
    const jwt = createAppJwt({ appId: 123, privateKey, now: () => now });
    const [header, payload, signature] = jwt.split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(claims).toEqual({ iss: '123', iat: now / 1000 - 60, exp: now / 1000 + 540 });
    const ok = createVerify('RSA-SHA256')
      .update(`${header}.${payload}`)
      .verify(createPublicKey(publicKey), Buffer.from(signature, 'base64url'));
    expect(ok).toBe(true);
  });

  it('expires within the ten minutes GitHub allows', () => {
    const jwt = createAppJwt({ appId: 1, privateKey, now: () => 1_000_000_000_000 });
    const claims = JSON.parse(Buffer.from(jwt.split('.')[1] as string, 'base64url').toString());
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
  });
});

function reply(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}

describe('createGithubClient', () => {
  it('exchanges the app token for an installation token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply({ token: 'ghs_abc', expires_at: '2026-11-21T13:00:00Z' }, 201));
    const client = createGithubClient({ fetch: fetchMock as unknown as typeof fetch });
    expect(await client.installationToken('app.jwt', 42)).toEqual({
      token: 'ghs_abc',
      expiresAt: '2026-11-21T13:00:00Z',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/app/installations/42/access_tokens');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer app.jwt');
  });

  it('lists every page of repositories, and stops at the first short page', async () => {
    const page = (n: number, size: number) =>
      reply({
        repositories: Array.from({ length: size }, (_, i) => ({
          id: n * 1000 + i + 1,
          full_name: `acme/r${n}-${i}`,
          default_branch: 'main',
        })),
      });
    const fetchMock = vi.fn().mockResolvedValueOnce(page(1, 100)).mockResolvedValueOnce(page(2, 3));
    const client = createGithubClient({ fetch: fetchMock as unknown as typeof fetch });
    const repos = await client.listInstallationRepositories('ghs_abc');
    expect(repos).toHaveLength(103);
    expect(repos[0]).toEqual({ id: 1001, fullName: 'acme/r1-0', defaultBranch: 'main' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('posts a pull request comment as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({}, 201));
    const client = createGithubClient({ fetch: fetchMock as unknown as typeof fetch });
    await client.commentOnPullRequest('ghs_abc', 'acme/api', 9, 'hello');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/acme/api/issues/9/comments');
    expect(JSON.parse(init.body as string)).toEqual({ body: 'hello' });
  });

  it('reports a failure with its status and never includes the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ message: 'Bad credentials' }, 401));
    const client = createGithubClient({ fetch: fetchMock as unknown as typeof fetch });
    const error = await client
      .listInstallationRepositories('ghs_secret_token')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GithubError);
    expect((error as GithubError).status).toBe(401);
    expect((error as GithubError).message).not.toContain('ghs_secret_token');
  });

  it('refuses a response that is not the shape it expects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ nope: true }));
    const client = createGithubClient({ fetch: fetchMock as unknown as typeof fetch });
    await expect(client.installationToken('jwt', 1)).rejects.toThrow(/unexpected/);
  });
});
