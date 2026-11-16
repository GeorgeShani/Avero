import { z } from 'zod';

const workerEnvironment = z.object({
  AVERO_WORKER_PORT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(3101),
});

export function readWorkerPort(environment: Record<string, string | undefined>): number {
  const result = workerEnvironment.safeParse(environment);
  if (!result.success) {
    throw new Error('AVERO_WORKER_PORT must be a whole number from 1 to 65535.');
  }

  return result.data.AVERO_WORKER_PORT;
}
