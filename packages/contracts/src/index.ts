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

export const workspaceRoles = ['owner', 'admin', 'member', 'viewer'] as const;
export const workspaceRoleSchema = z.enum(workspaceRoles);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceIdSchema = z.uuid();
export const workspaceNameSchema = z.string().trim().min(1).max(80);
export const workspaceInputSchema = z.strictObject({ name: workspaceNameSchema });
export const workspaceSchema = z.strictObject({
  id: workspaceIdSchema,
  name: workspaceNameSchema,
  slug: z
    .string()
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  role: workspaceRoleSchema,
});
export type Workspace = z.infer<typeof workspaceSchema>;

export * from './run-record.ts';
