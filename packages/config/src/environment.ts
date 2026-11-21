import { delimiter, isAbsolute } from 'node:path';
import { URL } from 'node:url';
import { z } from 'zod';
import { defaultAppUrl, defaultWorkerPort } from './constants.ts';

const workerEnvironment = z.object({
  AVERO_WORKER_PORT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(defaultWorkerPort),
});

export function readWorkerPort(environment: Record<string, string | undefined>): number {
  const result = workerEnvironment.safeParse(environment);
  if (!result.success) {
    throw new Error('AVERO_WORKER_PORT must be a whole number from 1 to 65535.');
  }

  return result.data.AVERO_WORKER_PORT;
}

const clerkEnvironment = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().regex(/^pk_(test|live)_\S+$/),
  CLERK_SECRET_KEY: z.string().regex(/^sk_(test|live)_\S+$/),
  AVERO_APP_URL: z.url({ protocol: /^https?$/ }).default(defaultAppUrl),
});

export function readClerkEnvironment(environment: Record<string, string | undefined>) {
  const parsed = clerkEnvironment.safeParse(environment);
  if (!parsed.success) return undefined;
  return {
    publishableKey: parsed.data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: parsed.data.CLERK_SECRET_KEY,
    authorizedParties: [new URL(parsed.data.AVERO_APP_URL).origin],
  };
}

const workerRuntimeEnvironment = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  AVERO_REPOSITORY_ROOTS: z.string().min(1),
  AVERO_CURSOR_MODEL: z.string().min(1).default('composer-2.5'),
  AVERO_WORKER_CONCURRENCY: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(16))
    .default(2),
  AVERO_WORKER_SANDBOX: z.enum(['on', 'off']).default('on'),
  AVERO_WORKER_GUARD: z.enum(['on', 'off']).default('on'),
});

export type WorkerRuntime = {
  databaseUrl: string;
  redisUrl: string;
  /** Folders tasks may run in, as absolute paths. */
  repositoryRoots: string[];
  defaultModel: string;
  concurrency: number;
  sandbox: boolean;
  /** Refuse risky shell commands with a Cursor hook the worker writes into each working copy. */
  guard: boolean;
};

/**
 * What the worker needs to take tasks: the database, Redis, and the folders it may touch. Undefined
 * when any of it is missing or wrong, so a worker without it stays a health endpoint and never
 * runs an agent anywhere it was not told to.
 */
export function readWorkerRuntime(
  environment: Record<string, string | undefined>,
): WorkerRuntime | undefined {
  const parsed = workerRuntimeEnvironment.safeParse(environment);
  if (!parsed.success) return undefined;
  const roots = parsed.data.AVERO_REPOSITORY_ROOTS.split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (roots.length === 0 || !roots.every((root) => isAbsolute(root))) return undefined;
  return {
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    repositoryRoots: roots,
    defaultModel: parsed.data.AVERO_CURSOR_MODEL,
    concurrency: parsed.data.AVERO_WORKER_CONCURRENCY,
    sandbox: parsed.data.AVERO_WORKER_SANDBOX === 'on',
    guard: parsed.data.AVERO_WORKER_GUARD === 'on',
  };
}

/** The folders tasks may run in, from AVERO_REPOSITORY_ROOTS. Empty when it is unset or invalid. */
export function readRepositoryRoots(environment: Record<string, string | undefined>): string[] {
  const raw = environment.AVERO_REPOSITORY_ROOTS?.trim();
  if (!raw) return [];
  const roots = raw
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return roots.every((root) => isAbsolute(root)) ? roots : [];
}

const githubEnvironment = z.object({
  GITHUB_APP_ID: z.string().regex(/^\d+$/),
  GITHUB_APP_SLUG: z.string().regex(/^[A-Za-z0-9-]+$/),
  GITHUB_APP_PRIVATE_KEY: z.string().min(100),
  GITHUB_WEBHOOK_SECRET: z.string().min(16),
  GITHUB_STATE_SECRET: z.string().min(16),
});

export type GithubSettings = {
  appId: string;
  /** The slug in github.com/apps/<slug>, for the install link. */
  appSlug: string;
  /** The app's PEM private key. A key stored with backslash-n sequences instead of newlines is accepted. */
  privateKey: string;
  webhookSecret: string;
  /** Signs the state that ties an installation to the workspace that started it. */
  stateSecret: string;
};

/** The GitHub App's credentials, or undefined when any of them is missing, so GitHub stays off. */
export function readGithubSettings(
  environment: Record<string, string | undefined>,
): GithubSettings | undefined {
  const parsed = githubEnvironment.safeParse(environment);
  if (!parsed.success) return undefined;
  return {
    appId: parsed.data.GITHUB_APP_ID,
    appSlug: parsed.data.GITHUB_APP_SLUG,
    privateKey: parsed.data.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    webhookSecret: parsed.data.GITHUB_WEBHOOK_SECRET,
    stateSecret: parsed.data.GITHUB_STATE_SECRET,
  };
}
