import { describe, expect, it } from 'vitest';
import { readClerkEnvironment, readWorkerPort } from './environment.ts';

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
