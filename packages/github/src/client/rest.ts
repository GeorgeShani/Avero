import { z } from 'zod';

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GithubError';
  }
}

type Fetch = typeof fetch;

const installationToken = z.object({ token: z.string().min(1), expires_at: z.iso.datetime() });
const repositoryList = z.object({
  repositories: z.array(
    z.object({
      id: z.number().int().positive(),
      full_name: z.string(),
      private: z.boolean().optional(),
      default_branch: z.string().optional(),
    }),
  ),
});

export type GithubRepository = { id: number; fullName: string; defaultBranch: string | null };

/**
 * A small GitHub REST client. It takes `fetch` so tests (and anything that needs a proxy or a
 * different base URL) can pass their own, and it never puts a token in a message or an error.
 */
export function createGithubClient(options: {
  fetch?: Fetch;
  apiBase?: string;
  timeoutMs?: number;
}) {
  const doFetch = options.fetch ?? fetch;
  const base = options.apiBase ?? 'https://api.github.com';

  async function request(
    method: string,
    path: string,
    auth: { bearer: string },
    body?: unknown,
  ): Promise<unknown> {
    const response = await doFetch(`${base}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${auth.bearer}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'avero',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    if (!response.ok) {
      throw new GithubError(
        `GitHub answered ${response.status} to ${method} ${path.split('?')[0]}.`,
        response.status,
      );
    }
    return response.status === 204 ? undefined : response.json();
  }

  return {
    /** Exchanges the app's JWT for a token that acts as one installation, for about an hour. */
    async installationToken(appJwt: string, installationId: number) {
      const parsed = installationToken.safeParse(
        await request('POST', `/app/installations/${installationId}/access_tokens`, {
          bearer: appJwt,
        }),
      );
      if (!parsed.success) throw new GithubError('GitHub sent an unexpected token response.', 502);
      return { token: parsed.data.token, expiresAt: parsed.data.expires_at };
    },

    /** Every repository the installation can see (up to 100 per page, all pages). */
    async listInstallationRepositories(token: string): Promise<GithubRepository[]> {
      const found: GithubRepository[] = [];
      for (let page = 1; page <= 20; page++) {
        const parsed = repositoryList.safeParse(
          await request('GET', `/installation/repositories?per_page=100&page=${page}`, {
            bearer: token,
          }),
        );
        if (!parsed.success)
          throw new GithubError('GitHub sent an unexpected repository list.', 502);
        found.push(
          ...parsed.data.repositories.map((repo) => ({
            id: repo.id,
            fullName: repo.full_name,
            defaultBranch: repo.default_branch ?? null,
          })),
        );
        if (parsed.data.repositories.length < 100) break;
      }
      return found;
    },

    /** Posts a comment on a pull request (pull requests are issues for comments). */
    async commentOnPullRequest(
      token: string,
      repository: string,
      number: number,
      markdown: string,
    ) {
      await request(
        'POST',
        `/repos/${repository}/issues/${number}/comments`,
        { bearer: token },
        { body: markdown },
      );
    },
  };
}

export type GithubClient = ReturnType<typeof createGithubClient>;
