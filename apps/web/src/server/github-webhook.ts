import type { TaskSource } from '@avero/contracts';
import { parseGithubEvent, pullRequestReviewPrompt, verifyWebhookSignature } from '@avero/github';

type Installation = { id: string; workspaceId: string; installationId: number; status: string };

export type WebhookDeps = {
  secret: string;
  defaultModel: string;
  /** True the first time a delivery id is seen. */
  recordDelivery: (deliveryId: string, event: string) => Promise<boolean>;
  findInstallation: (installationId: number) => Promise<Installation | undefined>;
  setInstallationStatus: (
    installationId: number,
    status: 'active' | 'suspended' | 'removed',
  ) => Promise<void>;
  addRepositories: (installation: Installation, names: string[]) => Promise<void>;
  detachRepositories: (installation: Installation, names: string[]) => Promise<void>;
  findRepository: (
    installationId: number,
    fullName: string,
  ) => Promise<{ id: string; workspaceId: string } | undefined>;
  hasReview: (
    repositoryId: string,
    source: Pick<TaskSource, 'number' | 'headSha'>,
  ) => Promise<boolean>;
  createReviewTask: (
    workspaceId: string,
    input: { repositoryId: string; prompt: string; model: string; source: TaskSource },
  ) => Promise<{ id: string }>;
};

export type WebhookResult = { status: 200 | 202 | 400 | 401; body: Record<string, unknown> };

/**
 * Handles one GitHub delivery. The signature is checked against the exact bytes first, and nothing
 * is parsed or stored from a request that fails it. A delivery id already seen is acknowledged and
 * ignored (GitHub redelivers). A pull request starts a review task only in a workspace whose
 * installation is active and reaches that repository, once per commit.
 */
export async function handleWebhook(
  request: {
    rawBody: string;
    signature: string | null;
    event: string | null;
    delivery: string | null;
  },
  deps: WebhookDeps,
): Promise<WebhookResult> {
  if (!verifyWebhookSignature(deps.secret, request.rawBody, request.signature))
    return { status: 401, body: { error: 'Bad signature' } };
  if (!request.event || !request.delivery)
    return { status: 400, body: { error: 'Missing event or delivery headers' } };

  let payload: unknown;
  try {
    payload = JSON.parse(request.rawBody);
  } catch {
    return { status: 400, body: { error: 'The body is not JSON' } };
  }

  if (!(await deps.recordDelivery(request.delivery, request.event)))
    return { status: 200, body: { duplicate: true } };

  const event = parseGithubEvent(request.event, payload);
  switch (event.kind) {
    case 'ignored':
      return { status: 200, body: { ignored: event.reason } };

    case 'installation': {
      const installation = await deps.findInstallation(event.installationId);
      // An installation is linked to a workspace by the person who installed it, in the callback.
      // A delivery for one nobody linked cannot be attributed to any workspace.
      if (!installation)
        return { status: 200, body: { ignored: 'installation is not linked to a workspace' } };
      if (event.action === 'deleted')
        await deps.setInstallationStatus(event.installationId, 'removed');
      else if (event.action === 'suspend')
        await deps.setInstallationStatus(event.installationId, 'suspended');
      else if (event.action === 'unsuspend')
        await deps.setInstallationStatus(event.installationId, 'active');
      else
        await deps.addRepositories(
          installation,
          event.repositories.map((repo) => repo.fullName),
        );
      return { status: 200, body: { handled: `installation ${event.action}` } };
    }

    case 'repositories': {
      const installation = await deps.findInstallation(event.installationId);
      if (!installation)
        return { status: 200, body: { ignored: 'installation is not linked to a workspace' } };
      if (event.added.length > 0)
        await deps.addRepositories(
          installation,
          event.added.map((repo) => repo.fullName),
        );
      if (event.removed.length > 0)
        await deps.detachRepositories(
          installation,
          event.removed.map((repo) => repo.fullName),
        );
      return { status: 200, body: { handled: 'repositories' } };
    }

    case 'pull_request': {
      if (event.draft) return { status: 200, body: { ignored: 'draft pull request' } };
      const repository = await deps.findRepository(event.installationId, event.repository.fullName);
      if (!repository) return { status: 200, body: { ignored: 'repository is not connected' } };
      const source: TaskSource = {
        kind: 'pull_request',
        repository: event.repository.fullName,
        number: event.number,
        headSha: event.headSha,
        baseRef: event.baseRef,
        title: event.title,
        body: event.body,
        url: event.url,
        installationId: event.installationId,
      };
      if (await deps.hasReview(repository.id, source))
        return { status: 200, body: { ignored: 'already reviewed this commit' } };
      const task = await deps.createReviewTask(repository.workspaceId, {
        repositoryId: repository.id,
        prompt: pullRequestReviewPrompt({
          repository: source.repository,
          number: source.number,
          title: source.title,
          body: source.body,
          headSha: source.headSha,
          baseRef: source.baseRef,
          url: source.url,
        }),
        model: deps.defaultModel,
        source,
      });
      return { status: 202, body: { taskId: task.id } };
    }
  }
}
