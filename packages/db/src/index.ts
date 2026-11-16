import { z } from 'zod';

export const postgresUrlSchema = z.url({ protocol: /^postgres(?:ql)?$/ });

export { connectDatabase } from './client.ts';
export { createWorkspace, listWorkspaces, readWorkspace, renameWorkspace } from './workspaces.ts';
export type { AveroDatabase } from './client.ts';
