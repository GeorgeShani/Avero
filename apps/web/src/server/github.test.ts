import type { Workspace } from '@avero/contracts';
import { signWebhookBody } from '@avero/github';
import { describe, expect, it, vi } from 'vitest';
import { finishInstall, startInstall } from './github-install';
import { handleWebhook, type WebhookDeps } from './github-webhook';

const secret = 'w'.repeat(20);
const sha = 'a'.repeat(40);
const installation = { id: 'pk1', workspaceId: 'ws1', installationId: 42, status: 'active' };

function deps(overrides: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    secret,
    defaultModel: 'composer-2.5',
    recordDelivery: vi.fn().mockResolvedValue(true),
    findInstallation: vi.fn().mockResolvedValue(installation),
    setInstallationStatus: vi.fn().mockResolvedValue(undefined),
    addRepositories: vi.fn().mockResolvedValue(undefined),
    detachRepositories: vi.fn().mockResolvedValue(undefined),
    findRepository: vi.fn().mockResolvedValue({ id: 'repo1', workspaceId: 'ws1' }),
    hasReview: vi.fn().mockResolvedValue(false),
    createReviewTask: vi.fn().mockResolvedValue({ id: 'task1' }),
    ...overrides,
  };
}

function delivery(
  event: string,
  payload: unknown,
  options: { signature?: string | null; delivery?: string | null } = {},
) {
  const rawBody = JSON.stringify(payload);
  return {
    rawBody,
    signature:
      options.signature === undefined ? signWebhookBody(secret, rawBody) : options.signature,
    event,
    delivery: options.delivery === undefined ? 'd-1' : options.delivery,
  };
}

const pullRequest = (
  extra: Record<string, unknown> = {},
  prExtra: Record<string, unknown> = {},
) => ({
  action: 'opened',
  installation: { id: 42 },
  repository: { id: 7, full_name: 'acme/api' },
  pull_request: {
    number: 9,
    title: 'Add retries',
    body: 'Please review.',
    html_url: 'https://github.com/acme/api/pull/9',
    head: { sha, ref: 'retries' },
    base: { ref: 'main' },
    ...prExtra,
  },
  ...extra,
});

describe('handleWebhook: trust', () => {
  it('refuses a missing or wrong signature before touching anything', async () => {
    const d = deps();
    for (const signature of [null, 'sha256=' + '0'.repeat(64), 'nonsense']) {
      expect(
        (await handleWebhook(delivery('pull_request', pullRequest(), { signature }), d)).status,
      ).toBe(401);
    }
    expect(d.recordDelivery).not.toHaveBeenCalled();
    expect(d.createReviewTask).not.toHaveBeenCalled();
  });

  it('refuses a signature that was made for a different body', async () => {
    const real = delivery('pull_request', pullRequest());
    const tampered = { ...real, rawBody: real.rawBody.replace('Add retries', 'Add retries!') };
    expect((await handleWebhook(tampered, deps())).status).toBe(401);
  });

  it('needs the event and delivery headers, and a JSON body', async () => {
    expect(
      (await handleWebhook(delivery('pull_request', pullRequest(), { delivery: null }), deps()))
        .status,
    ).toBe(400);
    const raw = 'not json';
    expect(
      (
        await handleWebhook(
          { rawBody: raw, signature: signWebhookBody(secret, raw), event: 'ping', delivery: 'd' },
          deps(),
        )
      ).status,
    ).toBe(400);
  });

  it('acknowledges and ignores a delivery it has already accepted', async () => {
    const d = deps({ recordDelivery: vi.fn().mockResolvedValue(false) });
    const result = await handleWebhook(delivery('pull_request', pullRequest()), d);
    expect(result).toEqual({ status: 200, body: { duplicate: true } });
    expect(d.createReviewTask).not.toHaveBeenCalled();
  });
});

describe('handleWebhook: pull requests', () => {
  it('starts a review task for an opened pull request in a connected repository', async () => {
    const d = deps();
    const result = await handleWebhook(delivery('pull_request', pullRequest()), d);
    expect(result).toEqual({ status: 202, body: { taskId: 'task1' } });
    const [workspaceId, input] = (d.createReviewTask as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { prompt: string; source: { headSha: string; number: number } },
    ];
    expect(workspaceId).toBe('ws1');
    expect(input.source).toMatchObject({
      number: 9,
      headSha: sha,
      repository: 'acme/api',
      installationId: 42,
    });
    expect(input.prompt).toContain('pull request #9 in acme/api');
  });

  it('ignores drafts, repositories nobody connected, and a commit already reviewed', async () => {
    expect(
      (await handleWebhook(delivery('pull_request', pullRequest({}, { draft: true })), deps()))
        .body,
    ).toMatchObject({ ignored: expect.stringContaining('draft') });
    const noRepo = deps({ findRepository: vi.fn().mockResolvedValue(undefined) });
    expect((await handleWebhook(delivery('pull_request', pullRequest()), noRepo)).status).toBe(200);
    expect(noRepo.createReviewTask).not.toHaveBeenCalled();
    const seen = deps({ hasReview: vi.fn().mockResolvedValue(true) });
    expect((await handleWebhook(delivery('pull_request', pullRequest()), seen)).body).toMatchObject(
      { ignored: expect.stringContaining('already') },
    );
    expect(seen.createReviewTask).not.toHaveBeenCalled();
  });

  it('looks the repository up by installation, so a delivery cannot reach another workspace’s repository', async () => {
    const d = deps();
    await handleWebhook(delivery('pull_request', pullRequest()), d);
    expect(d.findRepository).toHaveBeenCalledWith(42, 'acme/api');
  });

  it('never trusts an action it does not handle', async () => {
    const d = deps();
    const result = await handleWebhook(
      delivery('pull_request', pullRequest({ action: 'closed' })),
      d,
    );
    expect(result.body).toHaveProperty('ignored');
    expect(d.createReviewTask).not.toHaveBeenCalled();
  });
});

describe('handleWebhook: installations', () => {
  it('marks an installation removed, suspended and active again', async () => {
    const d = deps();
    for (const [action, status] of [
      ['deleted', 'removed'],
      ['suspend', 'suspended'],
      ['unsuspend', 'active'],
    ] as const) {
      await handleWebhook(
        delivery('installation', { action, installation: { id: 42 } }, { delivery: `d-${action}` }),
        d,
      );
      expect(d.setInstallationStatus).toHaveBeenCalledWith(42, status);
    }
  });

  it('adds and detaches repositories for a linked installation, and ignores an unlinked one', async () => {
    const d = deps();
    await handleWebhook(
      delivery('installation_repositories', {
        action: 'added',
        installation: { id: 42 },
        repositories_added: [{ id: 1, full_name: 'acme/new' }],
        repositories_removed: [{ id: 2, full_name: 'acme/old' }],
      }),
      d,
    );
    expect(d.addRepositories).toHaveBeenCalledWith(installation, ['acme/new']);
    expect(d.detachRepositories).toHaveBeenCalledWith(installation, ['acme/old']);

    const none = deps({ findInstallation: vi.fn().mockResolvedValue(undefined) });
    const result = await handleWebhook(
      delivery('installation', { action: 'deleted', installation: { id: 99 } }),
      none,
    );
    expect(result.body).toMatchObject({ ignored: expect.stringContaining('not linked') });
    expect(none.setInstallationStatus).not.toHaveBeenCalled();
  });
});

describe('installing the app', () => {
  const workspace = (role: Workspace['role']): Workspace => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'T',
    slug: 't-1',
    role,
  });
  const base = (role: Workspace['role'] | undefined) => ({
    stateSecret: 's'.repeat(20),
    appSlug: 'avero-dev',
    findWorkspace: vi.fn().mockResolvedValue(role ? workspace(role) : undefined),
  });

  it('sends an owner or admin to GitHub with a signed state, and refuses everyone else', async () => {
    const start = await startInstall(
      { userId: 'u1', workspaceId: workspace('owner').id },
      base('owner'),
    );
    expect(start.status).toBe(302);
    expect((start as { location: string }).location).toMatch(
      /^https:\/\/github\.com\/apps\/avero-dev\/installations\/new\?state=/,
    );
    expect((await startInstall({ userId: 'u1', workspaceId: 'x' }, base('member'))).status).toBe(
      403,
    );
    expect((await startInstall({ userId: 'u1', workspaceId: 'x' }, base(undefined))).status).toBe(
      404,
    );
  });

  it('links the installation and syncs its repositories when the state is the one issued to this person', async () => {
    const d = {
      ...base('admin'),
      link: vi.fn().mockResolvedValue(undefined),
      syncRepositories: vi.fn().mockResolvedValue(undefined),
    };
    const start = (await startInstall({ userId: 'u1', workspaceId: workspace('admin').id }, d)) as {
      location: string;
    };
    const state = decodeURIComponent(start.location.split('state=')[1] as string);
    const done = await finishInstall({ userId: 'u1', installationId: '42', state }, d);
    expect(done).toEqual({ status: 302, location: '/repositories' });
    expect(d.link).toHaveBeenCalledWith(workspace('admin').id, 42);
    expect(d.syncRepositories).toHaveBeenCalledWith(workspace('admin').id, 42);
  });

  it('refuses another person’s state, a forged one, a missing one, and someone who lost their role', async () => {
    const d = { ...base('admin'), link: vi.fn(), syncRepositories: vi.fn() };
    const start = (await startInstall({ userId: 'u1', workspaceId: workspace('admin').id }, d)) as {
      location: string;
    };
    const state = decodeURIComponent(start.location.split('state=')[1] as string);
    expect((await finishInstall({ userId: 'u2', installationId: '42', state }, d)).status).toBe(
      400,
    );
    expect(
      (await finishInstall({ userId: 'u1', installationId: '42', state: `${state}x` }, d)).status,
    ).toBe(400);
    expect(
      (await finishInstall({ userId: 'u1', installationId: '42', state: null }, d)).status,
    ).toBe(400);
    expect((await finishInstall({ userId: 'u1', installationId: 'abc', state }, d)).status).toBe(
      400,
    );
    const demoted = { ...d, findWorkspace: vi.fn().mockResolvedValue(workspace('member')) };
    expect(
      (await finishInstall({ userId: 'u1', installationId: '42', state }, demoted)).status,
    ).toBe(403);
    expect(d.link).not.toHaveBeenCalled();
    expect(demoted.link).not.toHaveBeenCalled();
  });

  it('gives the same answer when linking conflicts and when GitHub fails', async () => {
    const d = {
      ...base('owner'),
      link: vi.fn().mockRejectedValue(new Error('belongs to another workspace')),
      syncRepositories: vi.fn(),
    };
    const start = (await startInstall({ userId: 'u1', workspaceId: workspace('owner').id }, d)) as {
      location: string;
    };
    const state = decodeURIComponent(start.location.split('state=')[1] as string);
    expect(await finishInstall({ userId: 'u1', installationId: '42', state }, d)).toEqual({
      status: 502,
      body: { error: 'Could not connect that installation' },
    });
  });
});
