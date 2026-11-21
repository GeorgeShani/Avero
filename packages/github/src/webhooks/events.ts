import { z } from 'zod';

const account = z.object({ login: z.string().min(1).max(100) });
const installation = z.object({ id: z.number().int().positive(), account: account.optional() });
const repositoryRef = z.object({
  id: z.number().int().positive(),
  full_name: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/),
  private: z.boolean().optional(),
});

const installationEvent = z.object({
  action: z.enum(['created', 'deleted', 'suspend', 'unsuspend']),
  installation,
  repositories: z.array(repositoryRef).optional(),
});

const installationRepositoriesEvent = z.object({
  action: z.enum(['added', 'removed']),
  installation,
  repositories_added: z.array(repositoryRef).default([]),
  repositories_removed: z.array(repositoryRef).default([]),
});

const pullRequestEvent = z.object({
  action: z.enum(['opened', 'reopened', 'synchronize', 'ready_for_review']),
  installation: z.object({ id: z.number().int().positive() }),
  repository: repositoryRef,
  pull_request: z.object({
    number: z.number().int().positive(),
    title: z.string().max(1000),
    body: z.string().nullable().optional(),
    draft: z.boolean().optional(),
    html_url: z.url(),
    head: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/), ref: z.string() }),
    base: z.object({ ref: z.string() }),
  }),
});

export type GithubEvent =
  | {
      kind: 'installation';
      action: 'created' | 'deleted' | 'suspend' | 'unsuspend';
      installationId: number;
      account: string | null;
      repositories: { id: number; fullName: string }[];
    }
  | {
      kind: 'repositories';
      installationId: number;
      added: { id: number; fullName: string }[];
      removed: { id: number; fullName: string }[];
    }
  | {
      kind: 'pull_request';
      installationId: number;
      repository: { id: number; fullName: string };
      number: number;
      title: string;
      body: string;
      draft: boolean;
      url: string;
      headSha: string;
      headRef: string;
      baseRef: string;
    }
  | { kind: 'ignored'; reason: string };

const named = (repo: z.infer<typeof repositoryRef>) => ({ id: repo.id, fullName: repo.full_name });

/**
 * Turns a delivery into the one thing Avero cares about, or says why it ignores it. `name` is the
 * `X-GitHub-Event` header and `payload` the parsed body. A delivery whose shape is not what is
 * expected is ignored, never guessed at.
 */
export function parseGithubEvent(name: string, payload: unknown): GithubEvent {
  if (name === 'installation') {
    const parsed = installationEvent.safeParse(payload);
    if (!parsed.success)
      return { kind: 'ignored', reason: 'installation event in an unknown shape' };
    return {
      kind: 'installation',
      action: parsed.data.action,
      installationId: parsed.data.installation.id,
      account: parsed.data.installation.account?.login ?? null,
      repositories: (parsed.data.repositories ?? []).map(named),
    };
  }
  if (name === 'installation_repositories') {
    const parsed = installationRepositoriesEvent.safeParse(payload);
    if (!parsed.success)
      return { kind: 'ignored', reason: 'repositories event in an unknown shape' };
    return {
      kind: 'repositories',
      installationId: parsed.data.installation.id,
      added: parsed.data.repositories_added.map(named),
      removed: parsed.data.repositories_removed.map(named),
    };
  }
  if (name === 'pull_request') {
    const parsed = pullRequestEvent.safeParse(payload);
    if (!parsed.success)
      return { kind: 'ignored', reason: 'pull request action or shape not handled' };
    const { pull_request: pr } = parsed.data;
    return {
      kind: 'pull_request',
      installationId: parsed.data.installation.id,
      repository: named(parsed.data.repository),
      number: pr.number,
      title: pr.title,
      body: pr.body ?? '',
      draft: pr.draft ?? false,
      url: pr.html_url,
      headSha: pr.head.sha,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
    };
  }
  return { kind: 'ignored', reason: `event "${name}" is not handled` };
}
