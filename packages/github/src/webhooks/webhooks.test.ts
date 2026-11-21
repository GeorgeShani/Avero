import { describe, expect, it } from 'vitest';
import { parseGithubEvent } from './events.ts';
import { signWebhookBody, verifyWebhookSignature } from './signature.ts';

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ zen: 'Keep it logically awesome.' });

  it('accepts the signature of the exact body', () => {
    expect(verifyWebhookSignature(secret, body, signWebhookBody(secret, body))).toBe(true);
    expect(
      verifyWebhookSignature(secret, new TextEncoder().encode(body), signWebhookBody(secret, body)),
    ).toBe(true);
  });

  it('matches a signature computed independently of this code', () => {
    // openssl dgst -sha256 -hmac "It's a Secret to Everybody" with body "Hello, World!" (GitHub's docs example)
    const header = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
    expect(verifyWebhookSignature("It's a Secret to Everybody", 'Hello, World!', header)).toBe(
      true,
    );
  });

  it('refuses a changed body, a wrong secret, and a missing or malformed header', () => {
    const good = signWebhookBody(secret, body);
    expect(verifyWebhookSignature(secret, `${body} `, good)).toBe(false);
    expect(verifyWebhookSignature('other', body, good)).toBe(false);
    expect(verifyWebhookSignature(secret, body, null)).toBe(false);
    expect(verifyWebhookSignature(secret, body, undefined)).toBe(false);
    expect(verifyWebhookSignature(secret, body, good.replace('sha256=', 'sha1='))).toBe(false);
    expect(verifyWebhookSignature(secret, body, 'sha256=zz')).toBe(false);
    expect(verifyWebhookSignature(secret, body, `${good}00`)).toBe(false);
  });

  it('refuses everything when no secret is configured', () => {
    expect(verifyWebhookSignature('', body, signWebhookBody('', body))).toBe(false);
  });
});

const sha = 'a'.repeat(40);
const repo = { id: 7, full_name: 'acme/api', private: true };

describe('parseGithubEvent', () => {
  it('reads an installation being created with its repositories', () => {
    expect(
      parseGithubEvent('installation', {
        action: 'created',
        installation: { id: 42, account: { login: 'acme' } },
        repositories: [repo],
      }),
    ).toEqual({
      kind: 'installation',
      action: 'created',
      installationId: 42,
      account: 'acme',
      repositories: [{ id: 7, fullName: 'acme/api' }],
    });
  });

  it('reads repositories added to and removed from an installation', () => {
    expect(
      parseGithubEvent('installation_repositories', {
        action: 'added',
        installation: { id: 42 },
        repositories_added: [repo],
      }),
    ).toEqual({
      kind: 'repositories',
      installationId: 42,
      added: [{ id: 7, fullName: 'acme/api' }],
      removed: [],
    });
  });

  it('reads an opened pull request, and treats a missing description as empty', () => {
    const event = parseGithubEvent('pull_request', {
      action: 'opened',
      installation: { id: 42 },
      repository: repo,
      pull_request: {
        number: 9,
        title: 'Add retries',
        body: null,
        html_url: 'https://github.com/acme/api/pull/9',
        head: { sha, ref: 'retries' },
        base: { ref: 'main' },
      },
    });
    expect(event).toMatchObject({
      kind: 'pull_request',
      installationId: 42,
      repository: { fullName: 'acme/api' },
      number: 9,
      body: '',
      draft: false,
      headSha: sha,
      baseRef: 'main',
    });
  });

  it('ignores what it does not handle, with a reason, and never throws on a strange payload', () => {
    expect(parseGithubEvent('push', {})).toMatchObject({ kind: 'ignored' });
    expect(parseGithubEvent('pull_request', { action: 'closed' })).toMatchObject({
      kind: 'ignored',
    });
    expect(parseGithubEvent('pull_request', null)).toMatchObject({ kind: 'ignored' });
    expect(parseGithubEvent('installation', { action: 'created' })).toMatchObject({
      kind: 'ignored',
    });
    expect(
      parseGithubEvent('pull_request', {
        action: 'opened',
        installation: { id: 1 },
        repository: { id: 1, full_name: '../../etc/passwd' },
        pull_request: {},
      }),
    ).toMatchObject({ kind: 'ignored' });
  });
});
