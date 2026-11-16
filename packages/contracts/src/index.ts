import { z } from 'zod';

export const serviceHealthSchema = z.strictObject({
  service: z.enum(['web', 'worker']),
  status: z.literal('ok'),
});

export type ServiceHealth = z.infer<typeof serviceHealthSchema>;

export function serviceHealth(service: ServiceHealth['service']): ServiceHealth {
  return { service, status: 'ok' };
}

export const changeAssessmentInputSchema = z.strictObject({
  paths: z.array(z.string().min(1).max(1024)).min(1).max(100),
});
