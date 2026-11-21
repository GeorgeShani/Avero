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
