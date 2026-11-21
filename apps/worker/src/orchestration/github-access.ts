import { createAppJwt, createGithubClient, type GithubClient } from '@avero/github';
import type { GithubAccess } from './checkout.ts';

/** GitHub access backed by the real app credentials. Tokens are cached until just before they expire. */
export function createGithubAccess(
  settings: { appId: string; privateKey: string },
  client: GithubClient = createGithubClient({}),
): GithubAccess {
  const cache = new Map<number, { token: string; expiresAt: number }>();
  return {
    async token(installationId) {
      const cached = cache.get(installationId);
      if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;
      const jwt = createAppJwt({ appId: settings.appId, privateKey: settings.privateKey });
      const fresh = await client.installationToken(jwt, installationId);
      cache.set(installationId, { token: fresh.token, expiresAt: Date.parse(fresh.expiresAt) });
      return fresh.token;
    },
    comment: (token, fullName, number, markdown) =>
      client.commentOnPullRequest(token, fullName, number, markdown),
  };
}
