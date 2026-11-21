import 'server-only';
import { readGithubSettings } from '@avero/config';
import {
  addGithubRepositories,
  createTask,
  detachGithubRepositories,
  findGithubRepository,
  findInstallation,
  hasReviewFor,
  linkInstallation,
  recordDelivery,
  setInstallationStatus,
  syncGithubRepositories,
} from '@avero/db';
import { createAppJwt, createGithubClient } from '@avero/github';
import { handleWebhook, type WebhookDeps } from './github-webhook';
import { finishInstall, startInstall } from './github-install';
import { workspaceApiSession, workspaceJson } from './workspace-api';
import { database, queryWorkspace } from './workspaces';

export function githubSettings() {
  return readGithubSettings(process.env);
}

const unavailable = () => workspaceJson({ error: 'GitHub is not configured on this server' }, 503);

function defaultModel() {
  return process.env.AVERO_CURSOR_MODEL?.trim() || 'composer-2.5';
}

function webhookDeps(secret: string): WebhookDeps {
  const db = database();
  return {
    secret,
    defaultModel: defaultModel(),
    recordDelivery: (id, event) => recordDelivery(db, id, event),
    findInstallation: (id) => findInstallation(db, id),
    setInstallationStatus: (id, status) => setInstallationStatus(db, id, status),
    addRepositories: (installation, names) => addGithubRepositories(db, installation, names),
    detachRepositories: (installation, names) => detachGithubRepositories(db, installation, names),
    findRepository: (installationId, fullName) =>
      findGithubRepository(db, installationId, fullName),
    hasReview: (repositoryId, source) => hasReviewFor(db, repositoryId, source),
    createReviewTask: (workspaceId, input) =>
      createTask(
        db,
        workspaceId,
        {
          repositoryId: input.repositoryId,
          prompt: input.prompt,
          model: input.model,
          review: true,
        },
        { defaultModel: input.model, source: input.source },
      ),
  };
}

/** The webhook endpoint. Public by design: GitHub cannot sign in, so the signature is the only gate. */
export async function receiveGithubWebhook(request: Request): Promise<Response> {
  const settings = githubSettings();
  if (!settings) return unavailable();
  const result = await handleWebhook(
    {
      rawBody: await request.text(),
      signature: request.headers.get('x-hub-signature-256'),
      event: request.headers.get('x-github-event'),
      delivery: request.headers.get('x-github-delivery'),
    },
    webhookDeps(settings.webhookSecret),
  );
  return Response.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function beginGithubInstall(request: Request): Promise<Response> {
  const settings = githubSettings();
  if (!settings) return unavailable();
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  const workspaceId = new URL(request.url).searchParams.get('workspace') ?? '';
  const result = await startInstall(
    { userId: session.userId, workspaceId },
    { stateSecret: settings.stateSecret, appSlug: settings.appSlug, findWorkspace: queryWorkspace },
  );
  if (result.status === 302) return Response.redirect(result.location, 302);
  return workspaceJson(result.body, result.status);
}

export async function completeGithubInstall(request: Request): Promise<Response> {
  const settings = githubSettings();
  if (!settings) return unavailable();
  const session = await workspaceApiSession();
  if (session instanceof Response) return session;
  const db = database();
  const url = new URL(request.url);
  const client = createGithubClient({});
  const result = await finishInstall(
    {
      userId: session.userId,
      installationId: url.searchParams.get('installation_id'),
      state: url.searchParams.get('state'),
    },
    {
      stateSecret: settings.stateSecret,
      appSlug: settings.appSlug,
      findWorkspace: queryWorkspace,
      link: async (workspaceId, installationId) => {
        await linkInstallation(db, workspaceId, { installationId, account: null });
      },
      syncRepositories: async (_workspaceId, installationId) => {
        const jwt = createAppJwt({ appId: settings.appId, privateKey: settings.privateKey });
        const { token } = await client.installationToken(jwt, installationId);
        const reachable = await client.listInstallationRepositories(token);
        const installation = await findInstallation(db, installationId);
        if (!installation) throw new Error('The installation was not saved.');
        await syncGithubRepositories(db, installation, reachable);
      },
    },
  );
  if (result.status === 302) return Response.redirect(new URL(result.location, request.url), 302);
  return workspaceJson(result.body, result.status);
}
