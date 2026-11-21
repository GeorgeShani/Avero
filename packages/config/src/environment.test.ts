import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  readClerkEnvironment,
  readGithubSettings,
  readRepositoryRoots,
  readWorkerPort,
  readWorkerRuntime,
} from './environment.ts';

describe('readWorkerPort', () => {
  it('defaults to 3101 when unset', () => {
    expect(readWorkerPort({})).toBe(3101);
  });

  it('parses a valid port', () => {
    expect(readWorkerPort({ AVERO_WORKER_PORT: '8080' })).toBe(8080);
  });

  it.each(['0', '65536', '80.5', 'abc', '-1', ''])('rejects %j', (value) => {
    expect(() => readWorkerPort({ AVERO_WORKER_PORT: value })).toThrow(/AVERO_WORKER_PORT/);
  });
});

describe('readClerkEnvironment', () => {
  const valid = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc123',
    CLERK_SECRET_KEY: 'sk_test_abc123',
  };

  it('returns keys and the default app origin as the authorized party', () => {
    expect(readClerkEnvironment(valid)).toEqual({
      publishableKey: 'pk_test_abc123',
      secretKey: 'sk_test_abc123',
      authorizedParties: ['http://localhost:3000'],
    });
  });

  it('reduces AVERO_APP_URL to its origin', () => {
    const result = readClerkEnvironment({
      ...valid,
      AVERO_APP_URL: 'https://app.avero.dev/some/path',
    });
    expect(result?.authorizedParties).toEqual(['https://app.avero.dev']);
  });

  it('returns undefined when a key is missing or malformed', () => {
    expect(readClerkEnvironment({})).toBeUndefined();
    expect(readClerkEnvironment({ ...valid, CLERK_SECRET_KEY: 'pk_test_wrong' })).toBeUndefined();
    expect(
      readClerkEnvironment({ ...valid, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_wrong' }),
    ).toBeUndefined();
  });

  it('rejects non-http app URLs', () => {
    expect(readClerkEnvironment({ ...valid, AVERO_APP_URL: 'ftp://example.com' })).toBeUndefined();
  });
});

describe('readWorkerRuntime', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/avero',
    REDIS_URL: 'redis://127.0.0.1:6379',
    AVERO_REPOSITORY_ROOTS: resolve('/work/repos'),
  };

  it('reads the database, Redis and the allowed roots, with defaults for the rest', () => {
    expect(readWorkerRuntime(base)).toEqual({
      databaseUrl: base.DATABASE_URL,
      redisUrl: base.REDIS_URL,
      repositoryRoots: [resolve('/work/repos')],
      defaultModel: 'composer-2.5',
      concurrency: 2,
      sandbox: true,
      guard: true,
    });
  });

  it('stays undefined when anything it needs is missing, so a bare worker runs no agents', () => {
    expect(readWorkerRuntime({})).toBeUndefined();
    expect(readWorkerRuntime({ ...base, REDIS_URL: undefined })).toBeUndefined();
    expect(readWorkerRuntime({ ...base, DATABASE_URL: 'mysql://x/y' })).toBeUndefined();
  });

  it('refuses relative or empty roots, and takes several roots', () => {
    expect(readWorkerRuntime({ ...base, AVERO_REPOSITORY_ROOTS: 'repos' })).toBeUndefined();
    expect(readWorkerRuntime({ ...base, AVERO_REPOSITORY_ROOTS: '  ' })).toBeUndefined();
  });

  it('reads concurrency and the sandbox switch, and rejects nonsense for them', () => {
    expect(
      readWorkerRuntime({
        ...base,
        AVERO_WORKER_CONCURRENCY: '4',
        AVERO_WORKER_SANDBOX: 'off',
        AVERO_WORKER_GUARD: 'off',
      }),
    ).toMatchObject({ concurrency: 4, sandbox: false, guard: false });
    expect(readWorkerRuntime({ ...base, AVERO_WORKER_CONCURRENCY: '0' })).toBeUndefined();
    expect(readWorkerRuntime({ ...base, AVERO_WORKER_SANDBOX: 'maybe' })).toBeUndefined();
  });
});

describe('readRepositoryRoots', () => {
  it('lists the absolute roots, and nothing when unset, blank or not all absolute', () => {
    expect(readRepositoryRoots({ AVERO_REPOSITORY_ROOTS: resolve('/a') })).toEqual([resolve('/a')]);
    expect(readRepositoryRoots({})).toEqual([]);
    expect(readRepositoryRoots({ AVERO_REPOSITORY_ROOTS: '   ' })).toEqual([]);
    expect(readRepositoryRoots({ AVERO_REPOSITORY_ROOTS: 'relative' })).toEqual([]);
  });
});

describe('readGithubSettings', () => {
  const full = {
    GITHUB_APP_ID: '12345',
    GITHUB_APP_SLUG: 'avero-dev',
    GITHUB_APP_PRIVATE_KEY: `-----BEGIN RSA PRIVATE KEY-----\\n${'A'.repeat(120)}\\n-----END RSA PRIVATE KEY-----`,
    GITHUB_WEBHOOK_SECRET: 'w'.repeat(20),
    GITHUB_STATE_SECRET: 's'.repeat(20),
  };

  it('reads the app credentials, turning escaped newlines in the key into real ones', () => {
    const settings = readGithubSettings(full);
    expect(settings?.appId).toBe('12345');
    expect(settings?.appSlug).toBe('avero-dev');
    expect(settings?.privateKey).toContain('\n');
    expect(settings?.privateKey).not.toContain('\\n');
  });

  it('stays undefined when any credential is missing or too weak', () => {
    expect(readGithubSettings({})).toBeUndefined();
    expect(readGithubSettings({ ...full, GITHUB_WEBHOOK_SECRET: 'short' })).toBeUndefined();
    expect(readGithubSettings({ ...full, GITHUB_APP_ID: 'abc' })).toBeUndefined();
    expect(readGithubSettings({ ...full, GITHUB_STATE_SECRET: undefined })).toBeUndefined();
  });
});
